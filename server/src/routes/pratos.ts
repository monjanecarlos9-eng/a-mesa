import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError, idDe } from '../erros';
import { soAdmin } from '../middleware/auth';
import { ALERGENIOS, serializarPrato } from '../serializar';
import { avisarMenuAtualizado } from '../socket';

export const pratosRouter = Router();
pratosRouter.use(soAdmin);

// Sem .default() aqui: em zod 4, .partial() continua a aplicar os defaults,
// o que num PUT parcial (ex.: só o preço) apagaria a descrição e reporia "disponível".
const camposPrato = z.object({
  categoriaId: z.number().int().positive(),
  nome: z.string().trim().min(1, 'obrigatório').max(100),
  descricao: z.string().trim().max(500),
  preco: z
    .number()
    .min(0)
    .max(10000)
    .transform((v) => Math.round(v * 100) / 100),
  // Só URLs https://, http:// ou imagens carregadas aqui (/uploads/…). Bloqueia javascript:, data:, etc.
  imagemUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v) || /^\/uploads\/[a-f0-9]+\.(jpg|png|webp|gif)$/.test(v), 'URL de imagem inválido')
    .nullish()
    .transform((v) => v || null),
  disponivel: z.boolean(),
  // Tradução inglesa (opcional — se faltar, o menu em inglês mostra o texto português)
  nomeEn: z
    .string()
    .trim()
    .max(100)
    .nullish()
    .transform((v) => v || null),
  descricaoEn: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v || null),
  vegetariano: z.boolean(),
  semGluten: z.boolean(),
  alergenios: z
    .array(z.enum(ALERGENIOS))
    .max(ALERGENIOS.length)
    .transform((l) => [...new Set(l)]),
});
const criarPratoSchema = camposPrato.extend({
  descricao: camposPrato.shape.descricao.default(''),
  disponivel: camposPrato.shape.disponivel.default(true),
  vegetariano: camposPrato.shape.vegetariano.default(false),
  semGluten: camposPrato.shape.semGluten.default(false),
  alergenios: camposPrato.shape.alergenios.default([]),
});
const atualizarPratoSchema = camposPrato.partial();

pratosRouter.get('/', async (_req, res) => {
  const pratos = await prisma.prato.findMany({
    orderBy: [{ categoria: { ordem: 'asc' } }, { nome: 'asc' }],
  });
  res.json(pratos.map(serializarPrato));
});

pratosRouter.post('/', async (req, res) => {
  const dados = criarPratoSchema.parse(req.body);
  const prato = await prisma.prato.create({ data: dados });
  avisarMenuAtualizado();
  res.status(201).json(serializarPrato(prato));
});

pratosRouter.put('/:id', async (req, res) => {
  const dados = atualizarPratoSchema.parse(req.body);
  const prato = await prisma.prato.update({ where: { id: idDe(req.params.id) }, data: dados });
  avisarMenuAtualizado();
  res.json(serializarPrato(prato));
});

pratosRouter.patch('/:id/disponivel', async (req, res) => {
  const { disponivel } = z.object({ disponivel: z.boolean() }).parse(req.body);
  const prato = await prisma.prato.update({ where: { id: idDe(req.params.id) }, data: { disponivel } });
  avisarMenuAtualizado();
  res.json(serializarPrato(prato));
});

pratosRouter.delete('/:id', async (req, res) => {
  const id = idDe(req.params.id);
  const usados = await prisma.itemPedido.count({ where: { pratoId: id } });
  if (usados > 0) {
    throw new HttpError(409, 'Este prato já aparece em pedidos. Em vez de o apagar, marca-o como esgotado.');
  }
  await prisma.prato.delete({ where: { id } });
  avisarMenuAtualizado();
  res.status(204).end();
});

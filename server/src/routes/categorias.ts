import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError, idDe } from '../erros';
import { soAdmin } from '../middleware/auth';
import { avisarMenuAtualizado } from '../socket';

export const categoriasRouter = Router();
categoriasRouter.use(soAdmin);

const categoriaSchema = z.object({
  nome: z.string().trim().min(1, 'obrigatório').max(60),
  nomeEn: z
    .string()
    .trim()
    .max(60)
    .nullish()
    .transform((v) => v || null),
  ordem: z.number().int().min(0).max(1000).optional(),
});

categoriasRouter.get('/', async (_req, res) => {
  const categorias = await prisma.categoria.findMany({
    orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
    include: { _count: { select: { pratos: true } } },
  });
  res.json(categorias.map(({ _count, ...c }) => ({ ...c, totalPratos: _count.pratos })));
});

categoriasRouter.post('/', async (req, res) => {
  const dados = categoriaSchema.parse(req.body);
  const ultima = await prisma.categoria.aggregate({ _max: { ordem: true } });
  const categoria = await prisma.categoria.create({
    data: { nome: dados.nome, nomeEn: dados.nomeEn, ordem: dados.ordem ?? (ultima._max.ordem ?? -1) + 1 },
  });
  avisarMenuAtualizado();
  res.status(201).json(categoria);
});

categoriasRouter.put('/:id', async (req, res) => {
  const dados = categoriaSchema.partial().parse(req.body);
  const categoria = await prisma.categoria.update({ where: { id: idDe(req.params.id) }, data: dados });
  avisarMenuAtualizado();
  res.json(categoria);
});

categoriasRouter.delete('/:id', async (req, res) => {
  const id = idDe(req.params.id);
  const total = await prisma.prato.count({ where: { categoriaId: id } });
  if (total > 0) throw new HttpError(409, 'Esta categoria ainda tem pratos. Move-os ou apaga-os primeiro.');
  await prisma.categoria.delete({ where: { id } });
  avisarMenuAtualizado();
  res.status(204).end();
});

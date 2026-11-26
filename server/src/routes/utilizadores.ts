import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError, idDe } from '../erros';
import { soAdmin } from '../middleware/auth';
import { criarLinkRecuperacao } from '../recuperacao';
import { desligarSessoes } from '../socket';
import { auditar } from '../auditoria';

/** Gestão da equipa (só admin): aprovar contas, mudar papéis, remover, gerar link de senha. */
export const utilizadoresRouter = Router();
utilizadoresRouter.use(soAdmin);

const campos = { id: true, nome: true, email: true, papel: true, aprovado: true, criadoEm: true } as const;

utilizadoresRouter.get('/', async (_req, res) => {
  res.json(await prisma.utilizador.findMany({ select: campos, orderBy: [{ aprovado: 'asc' }, { nome: 'asc' }] }));
});

async function garantirOutroAdmin(id: number) {
  const outros = await prisma.utilizador.count({ where: { papel: 'admin', aprovado: true, id: { not: id } } });
  if (outros === 0) throw new HttpError(409, 'Tem de existir pelo menos um administrador ativo.');
}

utilizadoresRouter.patch('/:id', async (req, res) => {
  const id = idDe(req.params.id);
  const dados = z.object({ papel: z.enum(['admin', 'cozinha']).optional(), aprovado: z.boolean().optional() }).parse(req.body);
  const atual = await prisma.utilizador.findUnique({ where: { id } });
  if (!atual) throw new HttpError(404, 'Utilizador não encontrado.');
  const deixaDeSerAdmin = atual.papel === 'admin' && atual.aprovado && (dados.papel === 'cozinha' || dados.aprovado === false);
  if (deixaDeSerAdmin) await garantirOutroAdmin(id);

  const u = await prisma.utilizador.update({
    where: { id },
    // Mudar papel ou suspender termina as sessões abertas dessa pessoa.
    data: { ...dados, sessaoVersao: { increment: 1 } },
    select: campos,
  });
  desligarSessoes(id);
  auditar('utilizador_alterado', req, { alvo: id, ...dados });
  res.json(u);
});

utilizadoresRouter.delete('/:id', async (req, res) => {
  const id = idDe(req.params.id);
  if (id === req.utilizador!.id) throw new HttpError(409, 'Não podes apagar a tua própria conta.');
  const u = await prisma.utilizador.findUnique({ where: { id } });
  if (!u) throw new HttpError(404, 'Utilizador não encontrado.');
  if (u.papel === 'admin') await garantirOutroAdmin(id);
  await prisma.utilizador.delete({ where: { id } });
  desligarSessoes(id);
  auditar('utilizador_apagado', req, { alvo: id, email: u.email });
  res.status(204).end();
});

/** Útil quando não há email configurado: o admin gera o link e entrega-o à pessoa. */
utilizadoresRouter.post('/:id/link-recuperacao', async (req, res) => {
  const id = idDe(req.params.id);
  if (!(await prisma.utilizador.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError(404, 'Utilizador não encontrado.');
  auditar('link_recuperacao_gerado', req, { alvo: id });
  res.json({ link: await criarLinkRecuperacao(id) });
});

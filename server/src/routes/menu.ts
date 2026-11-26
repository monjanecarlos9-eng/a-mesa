import { Router } from 'express';
import { prisma } from '../prisma';
import { serializarPrato } from '../serializar';

export const menuRouter = Router();

/** Menu público: categorias por ordem, com os pratos (os esgotados vêm marcados com disponivel=false). */
menuRouter.get('/', async (_req, res) => {
  const categorias = await prisma.categoria.findMany({
    orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
    include: { pratos: { orderBy: { nome: 'asc' } } },
  });
  res.json(
    categorias
      .filter((c) => c.pratos.length > 0)
      .map((c) => ({ id: c.id, nome: c.nome, ordem: c.ordem, pratos: c.pratos.map(serializarPrato) })),
  );
});

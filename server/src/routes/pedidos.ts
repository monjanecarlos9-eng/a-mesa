import { Router } from 'express';
import { Prisma, EstadoPedido } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError, idDe } from '../erros';
import { equipa } from '../middleware/auth';
import { incluirPedido, serializarPedido } from '../serializar';
import { obterIo } from '../socket';

export const pedidosRouter = Router();

const ESTADOS = Object.values(EstadoPedido);

const criarSchema = z.object({
  token: z.string().min(1),
  itens: z
    .array(
      z.object({
        pratoId: z.number().int().positive(),
        quantidade: z.number().int().min(1).max(50),
        observacoes: z.string().trim().max(200).optional(),
      }),
    )
    .min(1, 'o carrinho está vazio')
    .max(50),
});

/** Cliente cria um pedido. Os preços vêm SEMPRE da base de dados, nunca do cliente. */
pedidosRouter.post('/', async (req, res) => {
  const dados = criarSchema.parse(req.body);

  const mesa = await prisma.mesa.findUnique({ where: { qrToken: dados.token } });
  if (!mesa) throw new HttpError(404, 'Mesa não encontrada. Lê o QR code outra vez.');

  const ids = [...new Set(dados.itens.map((i) => i.pratoId))];
  const pratos = await prisma.prato.findMany({ where: { id: { in: ids } } });
  const porId = new Map(pratos.map((p) => [p.id, p]));

  let total = new Prisma.Decimal(0);
  for (const item of dados.itens) {
    const prato = porId.get(item.pratoId);
    if (!prato) throw new HttpError(400, 'Um dos pratos já não existe. Atualiza o menu.');
    if (!prato.disponivel) throw new HttpError(409, `"${prato.nome}" está esgotado. Remove-o do carrinho.`);
    total = total.plus(prato.preco.times(item.quantidade));
  }

  const pedido = await prisma.pedido.create({
    data: {
      mesaId: mesa.id,
      total,
      itens: {
        create: dados.itens.map((i) => ({
          pratoId: i.pratoId,
          quantidade: i.quantidade,
          precoUnitario: porId.get(i.pratoId)!.preco,
          observacoes: i.observacoes || null,
        })),
      },
    },
    include: incluirPedido,
  });

  const resposta = serializarPedido(pedido);
  obterIo().to('equipa').emit('novo_pedido', resposta);
  res.status(201).json(resposta);
});

/** Cozinha: lista pedidos das últimas 24 h. ?estado=pendente,em_preparacao filtra. */
pedidosRouter.get('/', equipa, async (req, res) => {
  const filtro = typeof req.query.estado === 'string' && req.query.estado ? req.query.estado.split(',') : null;
  const estados = filtro ? z.array(z.enum(EstadoPedido)).parse(filtro) : undefined;

  const pedidos = await prisma.pedido.findMany({
    where: {
      criadoEm: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      ...(estados ? { estado: { in: estados } } : {}),
    },
    orderBy: { criadoEm: 'asc' },
    include: incluirPedido,
  });
  res.json(pedidos.map(serializarPedido));
});

/** Cliente: vê um pedido seu. Precisa do token da mesa (?token=) para não se verem pedidos alheios. */
pedidosRouter.get('/:id', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const pedido = await prisma.pedido.findFirst({
    where: { id: idDe(req.params.id), mesa: { qrToken: token } },
    include: incluirPedido,
  });
  if (!pedido) throw new HttpError(404, 'Pedido não encontrado.');
  res.json(serializarPedido(pedido));
});

/** Cozinha muda o estado → avisa a cozinha e o cliente desse pedido. */
pedidosRouter.patch('/:id/estado', equipa, async (req, res) => {
  const { estado } = z.object({ estado: z.enum(ESTADOS as [EstadoPedido, ...EstadoPedido[]]) }).parse(req.body);
  const pedido = await prisma.pedido.update({
    where: { id: idDe(req.params.id) },
    data: { estado },
    include: incluirPedido,
  });
  const resposta = serializarPedido(pedido);
  obterIo().to('equipa').to(`pedido:${pedido.id}`).emit('estado_atualizado', resposta);
  res.json(resposta);
});

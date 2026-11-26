import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError, idDe } from '../erros';
import { soAdmin } from '../middleware/auth';
import { obterIo } from '../socket';

export const mesasRouter = Router();

const novoToken = () => crypto.randomBytes(9).toString('base64url');
const numeroSchema = z.object({ numero: z.number().int().min(1).max(9999) });

// ---------- Público (cliente) ----------

/** Confirma que o QR code corresponde a uma mesa. */
mesasRouter.get('/:token', async (req, res) => {
  const mesa = await prisma.mesa.findUnique({
    where: { qrToken: req.params.token },
    select: { id: true, numero: true },
  });
  if (!mesa) throw new HttpError(404, 'Mesa não encontrada. Lê o QR code outra vez.');
  res.json(mesa);
});

const ultimaChamada = new Map<number, number>();
const INTERVALO_CHAMADA_MS = 30_000;

/** Botão "Chamar empregado". Limitado a uma chamada a cada 30 s por mesa. */
mesasRouter.post('/:token/chamar', async (req, res) => {
  const mesa = await prisma.mesa.findUnique({
    where: { qrToken: req.params.token },
    select: { id: true, numero: true },
  });
  if (!mesa) throw new HttpError(404, 'Mesa não encontrada.');

  const agora = Date.now();
  const anterior = ultimaChamada.get(mesa.id) ?? 0;
  if (agora - anterior < INTERVALO_CHAMADA_MS) {
    res.json({ ok: true, repetido: true });
    return;
  }
  ultimaChamada.set(mesa.id, agora);
  obterIo().to('equipa').emit('chamar_empregado', { mesa, em: new Date(agora).toISOString() });
  res.json({ ok: true });
});

// ---------- Administração ----------

mesasRouter.get('/', soAdmin, async (_req, res) => {
  res.json(await prisma.mesa.findMany({ orderBy: { numero: 'asc' } }));
});

mesasRouter.post('/', soAdmin, async (req, res) => {
  const { numero } = numeroSchema.parse(req.body);
  const mesa = await prisma.mesa.create({ data: { numero, qrToken: novoToken() } });
  res.status(201).json(mesa);
});

mesasRouter.put('/:id', soAdmin, async (req, res) => {
  const { numero } = numeroSchema.parse(req.body);
  res.json(await prisma.mesa.update({ where: { id: idDe(req.params.id) }, data: { numero } }));
});

/** Gera um token novo (o QR antigo deixa de funcionar). */
mesasRouter.post('/:id/regenerar', soAdmin, async (req, res) => {
  res.json(await prisma.mesa.update({ where: { id: idDe(req.params.id) }, data: { qrToken: novoToken() } }));
});

mesasRouter.delete('/:id', soAdmin, async (req, res) => {
  const id = idDe(req.params.id);
  const pedidos = await prisma.pedido.count({ where: { mesaId: id } });
  if (pedidos > 0) throw new HttpError(409, 'Esta mesa tem pedidos no histórico e não pode ser apagada.');
  await prisma.mesa.delete({ where: { id } });
  res.status(204).end();
});

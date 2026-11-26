import { Router } from 'express';
import { prisma } from '../prisma';
import { soAdmin } from '../middleware/auth';

export const estatisticasRouter = Router();
estatisticasRouter.use(soAdmin);

function inicioDoDia(d = new Date()) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function chaveDia(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

estatisticasRouter.get('/', async (_req, res) => {
  const hoje = inicioDoDia();
  const seteDias = new Date(hoje);
  seteDias.setDate(seteDias.getDate() - 6);

  const [resumoHoje, pagoHoje, emCurso, ultimos, topPratos] = await Promise.all([
    prisma.pedido.aggregate({ where: { criadoEm: { gte: hoje } }, _sum: { total: true }, _count: true }),
    prisma.pedido.aggregate({ where: { pagoEm: { gte: hoje } }, _sum: { total: true }, _count: true }),
    prisma.pedido.count({ where: { estado: { in: ['pendente', 'em_preparacao', 'pronto'] } } }),
    prisma.pedido.findMany({ where: { criadoEm: { gte: seteDias } }, select: { criadoEm: true, total: true } }),
    prisma.$queryRaw<{ id: number; nome: string; quantidade: number; receita: number }[]>`
      SELECT p.id, p.nome,
             SUM(i.quantidade)::int AS quantidade,
             SUM(i.quantidade * i.preco_unitario)::float AS receita
      FROM itens_pedido i
      JOIN pratos p ON p.id = i.prato_id
      GROUP BY p.id, p.nome
      ORDER BY quantidade DESC, receita DESC
      LIMIT 10`,
  ]);

  const porDia = new Map<string, { faturacao: number; pedidos: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(seteDias);
    d.setDate(d.getDate() + i);
    porDia.set(chaveDia(d), { faturacao: 0, pedidos: 0 });
  }
  for (const p of ultimos) {
    const dia = porDia.get(chaveDia(p.criadoEm));
    if (dia) {
      dia.faturacao += Number(p.total);
      dia.pedidos += 1;
    }
  }

  const faturacaoHoje = Number(resumoHoje._sum.total ?? 0);
  const pedidosHoje = resumoHoje._count;

  res.json({
    hoje: {
      faturacao: faturacaoHoje,
      pedidos: pedidosHoje,
      ticketMedio: pedidosHoje ? faturacaoHoje / pedidosHoje : 0,
      emCurso,
      pagoOnline: Number(pagoHoje._sum.total ?? 0),
      pedidosPagosOnline: pagoHoje._count,
    },
    ultimos7Dias: [...porDia.entries()].map(([dia, v]) => ({ dia, ...v, faturacao: Math.round(v.faturacao * 100) / 100 })),
    topPratos,
  });
});

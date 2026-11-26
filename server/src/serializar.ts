import type { Prato, Prisma } from '@prisma/client';

export function serializarPrato(p: Prato) {
  return {
    id: p.id,
    categoriaId: p.categoriaId,
    nome: p.nome,
    descricao: p.descricao,
    preco: Number(p.preco),
    imagemUrl: p.imagemUrl,
    disponivel: p.disponivel,
  };
}

export const incluirPedido = {
  mesa: { select: { id: true, numero: true } },
  itens: { include: { prato: { select: { nome: true } } }, orderBy: { id: 'asc' } },
} satisfies Prisma.PedidoInclude;

export type PedidoCompleto = Prisma.PedidoGetPayload<{ include: typeof incluirPedido }>;

export function serializarPedido(p: PedidoCompleto) {
  return {
    id: p.id,
    mesa: p.mesa,
    estado: p.estado,
    total: Number(p.total),
    criadoEm: p.criadoEm.toISOString(),
    itens: p.itens.map((i) => ({
      id: i.id,
      pratoId: i.pratoId,
      nome: i.prato.nome,
      quantidade: i.quantidade,
      precoUnitario: Number(i.precoUnitario),
      observacoes: i.observacoes,
    })),
  };
}

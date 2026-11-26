import type { Prato, Prisma } from '@prisma/client';

/** Os 14 alergénios de declaração obrigatória na UE (Regulamento 1169/2011). */
export const ALERGENIOS = [
  'gluten',
  'crustaceos',
  'ovos',
  'peixe',
  'amendoins',
  'soja',
  'leite',
  'frutos_casca_rija',
  'aipo',
  'mostarda',
  'sesamo',
  'sulfitos',
  'tremoco',
  'moluscos',
] as const;

export function serializarPrato(p: Prato) {
  return {
    id: p.id,
    categoriaId: p.categoriaId,
    nome: p.nome,
    descricao: p.descricao,
    nomeEn: p.nomeEn,
    descricaoEn: p.descricaoEn,
    preco: Number(p.preco),
    imagemUrl: p.imagemUrl,
    disponivel: p.disponivel,
    vegetariano: p.vegetariano,
    semGluten: p.semGluten,
    alergenios: p.alergenios,
  };
}

export const incluirPedido = {
  mesa: { select: { id: true, numero: true } },
  itens: { include: { prato: { select: { nome: true, nomeEn: true } } }, orderBy: { id: 'asc' } },
} satisfies Prisma.PedidoInclude;

export type PedidoCompleto = Prisma.PedidoGetPayload<{ include: typeof incluirPedido }>;

export function serializarPedido(p: PedidoCompleto) {
  return {
    id: p.id,
    mesa: p.mesa,
    estado: p.estado,
    total: Number(p.total),
    criadoEm: p.criadoEm.toISOString(),
    metodoPagamento: p.metodoPagamento,
    pagoEm: p.pagoEm?.toISOString() ?? null,
    itens: p.itens.map((i) => ({
      id: i.id,
      pratoId: i.pratoId,
      nome: i.prato.nome,
      nomeEn: i.prato.nomeEn,
      quantidade: i.quantidade,
      precoUnitario: Number(i.precoUnitario),
      observacoes: i.observacoes,
    })),
  };
}

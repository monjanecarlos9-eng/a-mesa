export type Estado = 'pendente' | 'em_preparacao' | 'pronto' | 'entregue';
export type Papel = 'admin' | 'cozinha';

export interface Prato {
  id: number;
  categoriaId: number;
  nome: string;
  descricao: string;
  preco: number;
  imagemUrl: string | null;
  disponivel: boolean;
  nomeEn: string | null;
  descricaoEn: string | null;
  vegetariano: boolean;
  semGluten: boolean;
  alergenios: string[];
}

export interface Categoria {
  id: number;
  nome: string;
  nomeEn?: string | null;
  ordem: number;
  totalPratos?: number;
}

export interface CategoriaMenu extends Categoria {
  pratos: Prato[];
}

export interface Mesa {
  id: number;
  numero: number;
  qrToken: string;
}

export interface ItemPedido {
  id: number;
  pratoId: number;
  nome: string;
  nomeEn: string | null;
  quantidade: number;
  precoUnitario: number;
  observacoes: string | null;
}

export interface Pedido {
  id: number;
  mesa: { id: number; numero: number };
  estado: Estado;
  total: number;
  criadoEm: string;
  metodoPagamento: 'mbway' | 'cartao' | null;
  pagoEm: string | null;
  itens: ItemPedido[];
}

export interface Utilizador {
  id: number;
  nome: string;
  email?: string;
  papel: Papel;
}

export const ESTADOS: { valor: Estado; rotulo: string; acao: string; cor: string }[] = [
  { valor: 'pendente', rotulo: 'Pendente', acao: 'Recebido', cor: 'bg-amber-500' },
  { valor: 'em_preparacao', rotulo: 'Em preparação', acao: 'Começar a preparar', cor: 'bg-sky-500' },
  { valor: 'pronto', rotulo: 'Pronto', acao: 'Marcar como pronto', cor: 'bg-emerald-500' },
  { valor: 'entregue', rotulo: 'Entregue', acao: 'Marcar como entregue', cor: 'bg-stone-400' },
];

export const indiceEstado = (e: Estado) => ESTADOS.findIndex((x) => x.valor === e);

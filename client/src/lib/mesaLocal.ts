// Dados guardados no telemóvel do cliente, por mesa (não há login para clientes).

export interface ItemCarrinho {
  chave: string; // pratoId + observações (o mesmo prato com notas diferentes são linhas diferentes)
  pratoId: number;
  nome: string;
  preco: number;
  quantidade: number;
  observacoes: string;
}

function ler<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}

export const carrinhoLocal = {
  ler: (token: string) => ler<ItemCarrinho[]>(`carrinho:${token}`, []),
  guardar: (token: string, itens: ItemCarrinho[]) => localStorage.setItem(`carrinho:${token}`, JSON.stringify(itens)),
};

/** IDs dos pedidos feitos neste telemóvel nesta mesa (guardamos só as últimas 12 horas). */
export const pedidosLocais = {
  ler: (token: string): number[] => {
    const limite = Date.now() - 12 * 60 * 60 * 1000;
    return ler<{ id: number; em: number }[]>(`pedidos:${token}`, [])
      .filter((p) => p.em > limite)
      .map((p) => p.id);
  },
  adicionar: (token: string, id: number) => {
    const lista = ler<{ id: number; em: number }[]>(`pedidos:${token}`, []);
    lista.push({ id, em: Date.now() });
    localStorage.setItem(`pedidos:${token}`, JSON.stringify(lista.slice(-20)));
  },
};

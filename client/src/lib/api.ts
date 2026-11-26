/** URL do back-end. Vazio em desenvolvimento (o Vite faz proxy). */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const CHAVE_TOKEN = 'token';

export const sessao = {
  obter: () => localStorage.getItem(CHAVE_TOKEN),
  guardar: (t: string) => localStorage.setItem(CHAVE_TOKEN, t),
  limpar: () => localStorage.removeItem(CHAVE_TOKEN),
};

type Opcoes = Omit<RequestInit, 'body'> & { json?: unknown; body?: BodyInit };

export async function api<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { json, ...resto } = opcoes;
  const headers = new Headers(resto.headers);
  const token = sessao.obter();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (json !== undefined) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${caminho}`, {
      ...resto,
      headers,
      body: json !== undefined ? JSON.stringify(json) : resto.body,
    });
  } catch {
    throw new ApiError(0, 'Sem ligação ao servidor. Verifica a internet.');
  }

  if (res.status === 204) return undefined as T;
  const dados = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) {
      sessao.limpar();
      window.dispatchEvent(new Event('sessao-expirada'));
    }
    throw new ApiError(res.status, dados?.erro ?? `Erro ${res.status}`);
  }
  return dados as T;
}

/** As imagens carregadas localmente vêm como "/uploads/…": junta-lhes o URL do back-end. */
export function urlImagem(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/') ? `${API_URL}${url}` : url;
}

export function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocorreu um erro inesperado.';
}

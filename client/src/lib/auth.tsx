import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, API_URL, sessao } from './api';
import type { Utilizador } from '../tipos';

interface ContextoAuth {
  utilizador: Utilizador | null;
  token: string | null;
  entrar: (email: string, password: string) => Promise<Utilizador>;
  /** Cria conta. Devolve o utilizador se ficou logo ativo (1.ª conta = admin), ou null se aguarda aprovação. */
  registar: (nome: string, email: string, password: string, codigo?: string) => Promise<Utilizador | null>;
  /** Substitui o token (ex.: depois de mudar a senha, que invalida os anteriores). */
  trocarToken: (token: string) => void;
  sair: () => void;
}

const Contexto = createContext<ContextoAuth | null>(null);

function lerUtilizador(): Utilizador | null {
  try {
    return sessao.obter() ? (JSON.parse(localStorage.getItem('utilizador') ?? 'null') as Utilizador | null) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilizador, setUtilizador] = useState<Utilizador | null>(lerUtilizador);
  const [token, setToken] = useState<string | null>(sessao.obter);

  const sair = useCallback(() => {
    // Pede ao servidor para invalidar este token. Não espera pela resposta: sair é sempre imediato.
    const tokenAtual = sessao.obter();
    if (tokenAtual) {
      fetch(`${API_URL}/api/auth/sair`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAtual}` },
        keepalive: true,
      }).catch(() => {});
    }
    sessao.limpar();
    localStorage.removeItem('utilizador');
    setUtilizador(null);
    setToken(null);
  }, []);

  useEffect(() => {
    window.addEventListener('sessao-expirada', sair);
    return () => window.removeEventListener('sessao-expirada', sair);
  }, [sair]);

  const iniciarSessao = useCallback((t: string, u: Utilizador) => {
    sessao.guardar(t);
    localStorage.setItem('utilizador', JSON.stringify(u));
    setToken(t);
    setUtilizador(u);
  }, []);

  const entrar = useCallback(
    async (email: string, password: string) => {
      const r = await api<{ token: string; utilizador: Utilizador }>('/auth/login', {
        method: 'POST',
        json: { email, password },
      });
      iniciarSessao(r.token, r.utilizador);
      return r.utilizador;
    },
    [iniciarSessao],
  );

  const registar = useCallback(
    async (nome: string, email: string, password: string, codigo?: string) => {
      const r = await api<{ pendente: boolean; token?: string; utilizador?: Utilizador }>('/auth/registar', {
        method: 'POST',
        json: { nome, email, password, codigo: codigo || undefined },
      });
      if (r.pendente || !r.token || !r.utilizador) return null;
      iniciarSessao(r.token, r.utilizador);
      return r.utilizador;
    },
    [iniciarSessao],
  );

  const trocarToken = useCallback((t: string) => {
    sessao.guardar(t);
    setToken(t);
  }, []);

  return <Contexto.Provider value={{ utilizador, token, entrar, registar, trocarToken, sair }}>{children}</Contexto.Provider>;
}

export function useAuth() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useAuth tem de estar dentro de <AuthProvider>');
  return c;
}

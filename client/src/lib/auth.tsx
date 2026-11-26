import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, sessao } from './api';
import type { Utilizador } from '../tipos';

interface ContextoAuth {
  utilizador: Utilizador | null;
  token: string | null;
  entrar: (email: string, password: string) => Promise<Utilizador>;
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
    sessao.limpar();
    localStorage.removeItem('utilizador');
    setUtilizador(null);
    setToken(null);
  }, []);

  useEffect(() => {
    window.addEventListener('sessao-expirada', sair);
    return () => window.removeEventListener('sessao-expirada', sair);
  }, [sair]);

  const entrar = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; utilizador: Utilizador }>('/auth/login', {
      method: 'POST',
      json: { email, password },
    });
    sessao.guardar(r.token);
    localStorage.setItem('utilizador', JSON.stringify(r.utilizador));
    setToken(r.token);
    setUtilizador(r.utilizador);
    return r.utilizador;
  }, []);

  return <Contexto.Provider value={{ utilizador, token, entrar, sair }}>{children}</Contexto.Provider>;
}

export function useAuth() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useAuth tem de estar dentro de <AuthProvider>');
  return c;
}

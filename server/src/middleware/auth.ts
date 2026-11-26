import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env';
import { HttpError } from '../erros';

export type Papel = 'admin' | 'cozinha';

export interface UtilizadorToken {
  id: number;
  nome: string;
  papel: Papel;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      utilizador?: UtilizadorToken;
    }
  }
}

export function assinarToken(u: UtilizadorToken): string {
  return jwt.sign({ id: u.id, nome: u.nome, papel: u.papel }, env.JWT_SECRET, { expiresIn: '12h' });
}

export function verificarToken(token: string): UtilizadorToken | null {
  try {
    const dados = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof dados.id !== 'number' || (dados.papel !== 'admin' && dados.papel !== 'cozinha')) return null;
    return { id: dados.id, nome: String(dados.nome ?? ''), papel: dados.papel };
  } catch {
    return null;
  }
}

/** Exige login. Se forem indicados papéis, exige também um deles. */
export function exigirLogin(...papeis: Papel[]): RequestHandler {
  return (req, _res, next) => {
    const cabecalho = req.headers.authorization ?? '';
    const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '';
    const utilizador = token ? verificarToken(token) : null;
    if (!utilizador) return next(new HttpError(401, 'Sessão inválida ou expirada. Entra de novo.'));
    if (papeis.length > 0 && !papeis.includes(utilizador.papel)) {
      return next(new HttpError(403, 'Não tens permissão para isto.'));
    }
    req.utilizador = utilizador;
    next();
  };
}

export const soAdmin = exigirLogin('admin');
export const equipa = exigirLogin('admin', 'cozinha');

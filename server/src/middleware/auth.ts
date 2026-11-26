import type { RequestHandler } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../env';
import { HttpError } from '../erros';
import { prisma } from '../prisma';

export type Papel = 'admin' | 'cozinha';

export interface UtilizadorToken {
  id: number;
  nome: string;
  papel: Papel;
}

/** Identifica o token desta sessão, para o logout o poder invalidar. */
export interface SessaoToken {
  jti: string;
  expiraEm: Date;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      utilizador?: UtilizadorToken;
      sessao?: SessaoToken;
    }
  }
}

export function assinarToken(u: { id: number; sessaoVersao: number }): string {
  return jwt.sign({ sub: String(u.id), v: u.sessaoVersao }, env.JWT_SECRET, {
    expiresIn: '12h',
    algorithm: 'HS256',
    jwtid: crypto.randomUUID(),
  });
}

/**
 * Valida o JWT e confirma na base de dados que a conta ainda existe, está aprovada,
 * que a sessão não foi invalidada (mudança de senha) e que não se fez logout com este token.
 * O papel vem sempre da BD, por isso uma alteração de papel tem efeito imediato.
 */
export async function verificarSessao(token: string): Promise<{ utilizador: UtilizadorToken; sessao: SessaoToken } | null> {
  let dados: jwt.JwtPayload;
  try {
    dados = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  } catch {
    return null;
  }
  const id = Number(dados.sub);
  if (!Number.isInteger(id) || typeof dados.v !== 'number' || typeof dados.jti !== 'string' || typeof dados.exp !== 'number') {
    return null;
  }
  const [u, terminada] = await Promise.all([
    prisma.utilizador.findUnique({
      where: { id },
      select: { id: true, nome: true, papel: true, aprovado: true, sessaoVersao: true },
    }),
    prisma.sessaoTerminada.findUnique({ where: { jti: dados.jti }, select: { jti: true } }),
  ]);
  if (!u || !u.aprovado || u.sessaoVersao !== dados.v || terminada) return null;
  return {
    utilizador: { id: u.id, nome: u.nome, papel: u.papel },
    sessao: { jti: dados.jti, expiraEm: new Date(dados.exp * 1000) },
  };
}

export async function verificarToken(token: string): Promise<UtilizadorToken | null> {
  return (await verificarSessao(token))?.utilizador ?? null;
}

/** Exige login. Se forem indicados papéis, exige também um deles. */
export function exigirLogin(...papeis: Papel[]): RequestHandler {
  return async (req, _res, next) => {
    const cabecalho = req.headers.authorization ?? '';
    const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '';
    const s = token ? await verificarSessao(token) : null;
    if (!s) return next(new HttpError(401, 'Sessão inválida ou expirada. Entra de novo.'));
    if (papeis.length > 0 && !papeis.includes(s.utilizador.papel)) {
      return next(new HttpError(403, 'Não tens permissão para isto.'));
    }
    req.utilizador = s.utilizador;
    req.sessao = s.sessao;
    next();
  };
}

export const soAdmin = exigirLogin('admin');
export const equipa = exigirLogin('admin', 'cozinha');

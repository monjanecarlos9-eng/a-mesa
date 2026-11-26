import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Converte um parâmetro da rota num ID inteiro positivo. */
export function idDe(valor: string | string[] | undefined): number {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'ID inválido');
  return n;
}

export const tratarErros: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ erro: err.message });
    return;
  }
  if (err instanceof ZodError) {
    const primeiro = err.issues[0];
    const campo = primeiro?.path.join('.');
    res.status(400).json({ erro: campo ? `${campo}: ${primeiro.message}` : 'Dados inválidos', detalhes: err.issues });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ erro: 'Já existe um registo com esse valor.' });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ erro: 'Não é possível apagar: há registos que dependem deste.' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ erro: 'Registo não encontrado.' });
      return;
    }
  }
  if (err?.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'A imagem tem mais de 5 MB.' : 'Upload inválido.';
    res.status(400).json({ erro: msg });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ erro: 'JSON inválido' });
    return;
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
};

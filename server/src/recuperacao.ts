import crypto from 'node:crypto';
import { env } from './env';
import { prisma } from './prisma';
import { sha256 } from './seguranca';

export const VALIDADE_RECUPERACAO_MIN = 30;

/** Cria um link de redefinição de senha de uso único. Invalida os links anteriores dessa conta. */
export async function criarLinkRecuperacao(utilizadorId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.$transaction([
    prisma.recuperacaoSenha.deleteMany({ where: { utilizadorId } }),
    prisma.recuperacaoSenha.create({
      data: {
        utilizadorId,
        tokenHash: sha256(token),
        expiraEm: new Date(Date.now() + VALIDADE_RECUPERACAO_MIN * 60_000),
      },
    }),
  ]);
  return `${env.APP_URL}/redefinir-senha/${token}`;
}

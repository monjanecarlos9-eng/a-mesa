import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { z } from 'zod';
import { auditar } from './auditoria';

export const CUSTO_BCRYPT = 12;

/** Hash real (de uma senha aleatória) para comparar quando o email não existe: o tempo de resposta fica igual. */
const HASH_FALSO = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), CUSTO_BCRYPT);

export async function compararSenha(senha: string, hash: string | undefined): Promise<boolean> {
  return bcrypt.compare(senha, hash ?? HASH_FALSO);
}

export const hashSenha = (senha: string) => bcrypt.hash(senha, CUSTO_BCRYPT);

export const sha256 = (texto: string) => crypto.createHash('sha256').update(texto).digest('hex');

export const senhaSchema = z
  .string()
  .min(8, 'a palavra-passe tem de ter pelo menos 8 caracteres')
  .max(72, 'a palavra-passe pode ter no máximo 72 caracteres') // limite do bcrypt
  .refine((s) => /[A-Za-z]/.test(s) && /\d/.test(s), 'a palavra-passe tem de ter letras e números');

export const emailSchema = z.string().trim().toLowerCase().email('email inválido').max(200);

type OpcoesLimite = {
  /** Por omissão conta por IP. Num restaurante, todos os clientes (e a equipa) partilham o IP do Wi-Fi. */
  chave?: (req: Request) => string;
  /** Não contar pedidos bem-sucedidos (ex.: logins certos). */
  soFalhas?: boolean;
};

function limitador(nome: string, janelaMin: number, maximo: number, mensagem: string, opcoes: OpcoesLimite = {}) {
  return rateLimit({
    windowMs: janelaMin * 60_000,
    limit: maximo,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: opcoes.soFalhas ?? false,
    ...(opcoes.chave ? { keyGenerator: opcoes.chave } : {}),
    handler: (req, res, _next, op) => {
      auditar('limite_atingido', req, { limite: nome, rota: req.originalUrl });
      res.status(op.statusCode).json({ erro: mensagem });
    },
  });
}

/** Conta por mesa (token do QR) em vez de por IP: as mesas não se bloqueiam umas às outras. */
const porMesa = (req: Request) => {
  const t = req.body?.token ?? req.params?.token;
  return `mesa:${typeof t === 'string' ? t.slice(0, 100) : 'sem-token'}`;
};

/** Conta por email: trava ataques à mesma conta vindos de muitos IPs diferentes. */
const porConta = (req: Request) => {
  const e = req.body?.email;
  return `conta:${typeof e === 'string' ? e.trim().toLowerCase().slice(0, 200) : 'sem-email'}`;
};

export const limites = {
  geral: limitador('geral', 1, 600, 'Demasiados pedidos. Espera um pouco.'),
  // Só as tentativas falhadas contam: a equipa toda entra pelo mesmo IP sem se bloquear.
  login: limitador('login_ip', 15, 10, 'Demasiadas tentativas falhadas. Tenta de novo daqui a 15 minutos.', { soFalhas: true }),
  loginConta: limitador('login_conta', 60, 20, 'Esta conta foi bloqueada temporariamente por excesso de tentativas. Tenta daqui a 1 hora ou recupera a senha.', {
    chave: porConta,
    soFalhas: true,
  }),
  registo: limitador('registo', 60, 10, 'Demasiados registos a partir desta rede. Tenta mais tarde.'),
  // Pedir links de recuperação (envia emails) — apertado, por IP e por conta.
  recuperacao: limitador('recuperacao_ip', 15, 5, 'Demasiados pedidos de recuperação. Tenta daqui a 15 minutos.'),
  recuperacaoConta: limitador('recuperacao_conta', 60, 3, 'Já pedimos vários links para esta conta. Vê o teu email ou tenta daqui a 1 hora.', { chave: porConta }),
  // Usar um link (abrir + gravar a senha). O token tem 256 bits, não é adivinhável; isto só trava abusos.
  redefinir: limitador('redefinir', 15, 30, 'Demasiadas tentativas. Tenta daqui a 15 minutos.'),
  pedidos: limitador('pedidos', 1, 10, 'Esta mesa está a enviar pedidos depressa demais. Espera um minuto.', { chave: porMesa }),
  chamar: limitador('chamar', 1, 6, 'Já chamaram o empregado. Ele vem já!', { chave: porMesa }),
};

/** Compara dois segredos em tempo constante (não revela, pelo tempo, quantos caracteres acertaram). */
export function segredoIgual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

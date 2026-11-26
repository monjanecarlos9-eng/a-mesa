import 'dotenv/config';

const producao = process.env.NODE_ENV === 'production';

function obrigatorioEmProducao(nome: string, valorDev: string): string {
  const v = process.env[nome];
  if (v) return v;
  if (producao) throw new Error(`Define a variável ${nome} em produção.`);
  return valorDev;
}

const JWT_SECRET = obrigatorioEmProducao('JWT_SECRET', 'segredo-so-para-desenvolvimento');
if (producao && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET tem de ter pelo menos 32 caracteres em produção.');
}

/** Origens autorizadas (CORS), separadas por vírgulas. Em produção é obrigatório. */
const FRONTEND_URL = obrigatorioEmProducao('FRONTEND_URL', '');
const origens = FRONTEND_URL.split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const env = {
  producao,
  PORT: Number(process.env.PORT ?? 4000),
  JWT_SECRET,
  /** Lista de origens permitidas; vazia em desenvolvimento = aceita qualquer origem. */
  ORIGENS: origens,
  /** URL público do site, usado nos links de recuperação de senha. */
  APP_URL: (process.env.APP_URL || origens[0] || 'http://localhost:5180').replace(/\/$/, ''),
  /** Se definido (cloudinary://key:secret@cloud), as imagens vão para o Cloudinary. */
  CLOUDINARY_URL: process.env.CLOUDINARY_URL ?? '',
  /** SMTP para enviar emails (ex.: smtps://utilizador:senha@smtp.gmail.com:465). Sem ele, o link aparece na consola. */
  SMTP_URL: process.env.SMTP_URL ?? '',
  EMAIL_REMETENTE: process.env.EMAIL_REMETENTE ?? 'Tasca do Zé <no-reply@tascadoze.pt>',
  /**
   * Código secreto exigido para criar a PRIMEIRA conta (admin) em produção.
   * Sem ele, quem encontrasse o site antes do dono podia registar-se e ficar admin.
   */
  CODIGO_CONFIGURACAO: process.env.CODIGO_CONFIGURACAO ?? '',
  /**
   * Quantos proxies à frente do servidor (Render = 1). Só com proxy se pode confiar no X-Forwarded-For;
   * sem proxy, um atacante falsificava esse cabeçalho para fugir aos limites de tentativas.
   */
  TRUST_PROXY: Number(process.env.TRUST_PROXY ?? (producao ? 1 : 0)),
};

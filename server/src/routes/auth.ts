import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { HttpError } from '../erros';
import { assinarToken, equipa } from '../middleware/auth';
import { compararSenha, emailSchema, hashSenha, limites, segredoIgual, senhaSchema, sha256 } from '../seguranca';
import { criarLinkRecuperacao, VALIDADE_RECUPERACAO_MIN } from '../recuperacao';
import { enviarEmail } from '../email';
import { desligarSessoes, obterIo } from '../socket';
import { auditar } from '../auditoria';
import { env } from '../env';

export const authRouter = Router();

const publico = (u: { id: number; nome: string; email: string; papel: 'admin' | 'cozinha' }) => ({
  id: u.id,
  nome: u.nome,
  email: u.email,
  papel: u.papel,
});

// ---------- Entrar ----------

authRouter.post('/login', limites.login, limites.loginConta, async (req, res) => {
  const { email, password } = z.object({ email: emailSchema, password: z.string().min(1).max(200) }).parse(req.body);
  const u = await prisma.utilizador.findUnique({ where: { email } });
  // Compara sempre (mesmo sem utilizador) para não revelar, pelo tempo de resposta, quais emails existem.
  const ok = await compararSenha(password, u?.passwordHash);
  if (!u || !ok) {
    auditar('login_falhado', req, { email, existe: !!u });
    throw new HttpError(401, 'Email ou palavra-passe errados.');
  }
  if (!u.aprovado) throw new HttpError(403, 'A tua conta ainda aguarda aprovação do administrador.');

  auditar('login', req, { utilizador: u.id, papel: u.papel });
  res.json({ token: assinarToken(u), utilizador: publico(u) });
});

/** Diz à página de registo se esta é a primeira conta (e se precisa do código de configuração). */
authRouter.get('/configuracao', async (_req, res) => {
  const primeiraConta = (await prisma.utilizador.count()) === 0;
  res.json({ primeiraConta, exigeCodigo: primeiraConta && env.producao });
});

/**
 * Terminar sessão: o token atual deixa de ser aceite pelo servidor, mesmo que alguém o tenha copiado.
 * As outras sessões da mesma conta (ex.: o tablet da cozinha) continuam ativas.
 */
authRouter.post('/sair', equipa, async (req, res) => {
  const { jti, expiraEm } = req.sessao!;
  await prisma.$transaction([
    prisma.sessaoTerminada.deleteMany({ where: { expiraEm: { lt: new Date() } } }), // limpeza dos já expirados
    prisma.sessaoTerminada.upsert({ where: { jti }, create: { jti, expiraEm }, update: {} }),
  ]);
  auditar('logout', req);
  res.status(204).end();
});

authRouter.get('/eu', equipa, async (req, res) => {
  const u = await prisma.utilizador.findUniqueOrThrow({ where: { id: req.utilizador!.id } });
  res.json({ utilizador: publico(u) });
});

// ---------- Criar conta ----------

/**
 * A primeira conta do sistema torna-se admin (para arrancar em produção sem senhas por omissão).
 * As seguintes ficam pendentes até um admin as aprovar e escolher o papel.
 */
authRouter.post('/registar', limites.registo, async (req, res) => {
  const dados = z
    .object({
      nome: z.string().trim().min(2, 'nome demasiado curto').max(80),
      email: emailSchema,
      password: senhaSchema,
      codigo: z.string().trim().max(200).optional(),
    })
    .parse(req.body);

  const passwordHash = await hashSenha(dados.password);
  const primeira = (await prisma.utilizador.count()) === 0;

  // Em produção, a 1.ª conta (que fica admin) exige o código secreto definido no servidor.
  if (primeira && env.producao) {
    if (!env.CODIGO_CONFIGURACAO) {
      throw new HttpError(503, 'O servidor ainda não tem CODIGO_CONFIGURACAO definido. Define-o no Render para criar a conta de administrador.');
    }
    if (!dados.codigo || !segredoIgual(dados.codigo, env.CODIGO_CONFIGURACAO)) {
      auditar('codigo_configuracao_errado', req, { email: dados.email });
      throw new HttpError(403, 'Código de configuração errado.');
    }
  }

  const existe = await prisma.utilizador.findUnique({ where: { email: dados.email }, select: { id: true } });
  if (existe) throw new HttpError(409, 'Já existe uma conta com esse email. Se te esqueceste da senha, usa "Recuperar senha".');

  const u = await prisma.utilizador.create({
    data: { nome: dados.nome, email: dados.email, passwordHash, papel: primeira ? 'admin' : 'cozinha', aprovado: primeira },
  });

  auditar('conta_criada', req, { novo: u.id, email: u.email, admin: primeira });
  if (primeira) {
    res.status(201).json({ pendente: false, token: assinarToken(u), utilizador: publico(u) });
    return;
  }
  obterIo().to('admins').emit('conta_pendente', { id: u.id, nome: u.nome });
  res.status(201).json({ pendente: true });
});

// ---------- Recuperar senha ----------

authRouter.post('/recuperar', limites.recuperacao, limites.recuperacaoConta, async (req, res) => {
  const { email } = z.object({ email: emailSchema }).parse(req.body);
  const u = await prisma.utilizador.findUnique({ where: { email } });
  auditar('recuperacao_pedida', req, { email, existe: !!u });
  if (u) {
    const link = await criarLinkRecuperacao(u.id);
    await enviarEmail(
      u.email,
      'Recuperar a palavra-passe — Tasca do Zé',
      `Olá ${u.nome},\n\nPara escolheres uma nova palavra-passe abre este link (válido durante ${VALIDADE_RECUPERACAO_MIN} minutos):\n\n${link}\n\nSe não pediste isto, ignora este email — a tua senha continua igual.`,
    ).catch((e) => console.error('[email] falhou o envio', e));
  }
  // Resposta igual quer o email exista quer não (não revela quem tem conta).
  res.json({ ok: true, mensagem: 'Se existir uma conta com esse email, enviámos um link para redefinir a palavra-passe.' });
});

async function recuperacaoValida(token: string) {
  const r = await prisma.recuperacaoSenha.findUnique({ where: { tokenHash: sha256(token) }, include: { utilizador: true } });
  if (!r || r.usadoEm || r.expiraEm < new Date()) {
    throw new HttpError(400, 'Este link é inválido ou já expirou. Pede um novo.');
  }
  return r;
}

/** Permite à página confirmar o link antes de mostrar o formulário. */
authRouter.get('/redefinir/:token', limites.redefinir, async (req, res) => {
  const r = await recuperacaoValida(String(req.params.token));
  res.json({ email: r.utilizador.email });
});

authRouter.post('/redefinir', limites.redefinir, async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(20).max(200), password: senhaSchema }).parse(req.body);
  const r = await recuperacaoValida(token);
  const passwordHash = await hashSenha(password);
  await prisma.$transaction([
    // sessaoVersao + 1 termina todas as sessões abertas dessa conta
    prisma.utilizador.update({ where: { id: r.utilizadorId }, data: { passwordHash, sessaoVersao: { increment: 1 } } }),
    prisma.recuperacaoSenha.deleteMany({ where: { utilizadorId: r.utilizadorId } }),
  ]);
  desligarSessoes(r.utilizadorId);
  auditar('senha_redefinida', req, { alvo: r.utilizadorId });
  res.json({ ok: true });
});

// ---------- Mudar a própria senha ----------

authRouter.post('/alterar-senha', equipa, limites.login, async (req, res) => {
  const { atual, nova } = z.object({ atual: z.string().min(1).max(200), nova: senhaSchema }).parse(req.body);
  const u = await prisma.utilizador.findUniqueOrThrow({ where: { id: req.utilizador!.id } });
  if (!(await compararSenha(atual, u.passwordHash))) {
    auditar('alterar_senha_falhado', req);
    throw new HttpError(400, 'A palavra-passe atual está errada.');
  }
  const atualizado = await prisma.utilizador.update({
    where: { id: u.id },
    data: { passwordHash: await hashSenha(nova), sessaoVersao: { increment: 1 } },
  });
  // Corta as ligações em tempo real antigas e devolve um token novo para esta sessão continuar.
  desligarSessoes(u.id);
  auditar('senha_alterada', req);
  res.json({ token: assinarToken(atualizado) });
});

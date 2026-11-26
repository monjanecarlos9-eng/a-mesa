import type { Request } from 'express';

/**
 * Registo de eventos de segurança: uma linha JSON por evento, na consola (no Render aparece em "Logs").
 * Nunca regista senhas, tokens nem dados pessoais além do email e do IP.
 *
 * Exemplos: login_falhado, limite_atingido, conta_criada, papel_alterado, senha_redefinida.
 */
export function auditar(evento: string, req: Request | null, dados: Record<string, unknown> = {}) {
  const linha = {
    quando: new Date().toISOString(),
    evento,
    ip: req?.ip,
    utilizador: req?.utilizador?.id,
    ...dados,
  };
  console.warn(`[seguranca] ${JSON.stringify(linha)}`);
}

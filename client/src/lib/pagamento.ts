// Validações do pagamento simulado. Correm só no browser: o servidor nunca recebe dados do cartão.

/** Algoritmo de Luhn: valida o dígito de controlo de um número de cartão. */
export function luhnValido(numero: string): boolean {
  const d = numero.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let soma = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    soma += n;
  }
  return soma % 10 === 0;
}

/** Validade no formato MM/AA, ainda não expirada. */
export function validadeValida(v: string, agora = new Date()): boolean {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(v);
  if (!m) return false;
  const mes = Number(m[1]);
  const ano = 2000 + Number(m[2]);
  if (mes < 1 || mes > 12) return false;
  const fimDoMes = new Date(ano, mes, 1); // 1.º dia do mês seguinte
  return fimDoMes > agora;
}

/** Telemóvel português para MB Way: 9 dígitos a começar por 9 (aceita espaços). */
export function telemovelValido(numero: string): boolean {
  return /^9\d{8}$/.test(numero.replace(/\s/g, ''));
}

/** CVV: 3 ou 4 dígitos. */
export function cvvValido(cvv: string): boolean {
  return /^\d{3,4}$/.test(cvv);
}

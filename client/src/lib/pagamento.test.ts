import { describe, expect, it } from 'vitest';
import { cvvValido, luhnValido, telemovelValido, validadeValida } from './pagamento';

describe('pagamento simulado — validações', () => {
  it('aceita cartões de teste válidos (Luhn) com ou sem espaços', () => {
    expect(luhnValido('4111 1111 1111 1111')).toBe(true);
    expect(luhnValido('5555555555554444')).toBe(true);
  });

  it('rejeita cartões com o dígito de controlo errado ou tamanho inválido', () => {
    expect(luhnValido('4111 1111 1111 1112')).toBe(false);
    expect(luhnValido('1234')).toBe(false);
    expect(luhnValido('')).toBe(false);
  });

  it('valida a data de validade MM/AA e rejeita cartões expirados', () => {
    const hoje = new Date(2026, 10, 26); // 26/11/2026
    expect(validadeValida('12/30', hoje)).toBe(true);
    expect(validadeValida('11/26', hoje)).toBe(true); // válido até ao fim do mês
    expect(validadeValida('10/26', hoje)).toBe(false);
    expect(validadeValida('13/30', hoje)).toBe(false);
    expect(validadeValida('1230', hoje)).toBe(false);
  });

  it('valida o telemóvel do MB Way e o CVV', () => {
    expect(telemovelValido('912 345 678')).toBe(true);
    expect(telemovelValido('212345678')).toBe(false);
    expect(telemovelValido('91234567')).toBe(false);
    expect(cvvValido('123')).toBe(true);
    expect(cvvValido('12a')).toBe(false);
  });
});

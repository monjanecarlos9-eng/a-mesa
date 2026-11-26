import { describe, expect, it } from 'vitest';
import { formatarPreco, haQuantoTempo } from './formatar';

describe('formatar', () => {
  it('formata preços em euros no formato português', () => {
    // O Intl usa um espaço não separável antes do €
    expect(formatarPreco(12.5).replace(/\s/g, ' ')).toBe('12,50 €');
    expect(formatarPreco(0).replace(/\s/g, ' ')).toBe('0,00 €');
  });

  it('mostra há quanto tempo um pedido foi feito', () => {
    const agora = new Date('2026-11-26T12:00:00Z').getTime();
    expect(haQuantoTempo('2026-11-26T11:59:30Z', agora)).toBe('agora');
    expect(haQuantoTempo('2026-11-26T11:45:00Z', agora)).toBe('há 15 min');
    expect(haQuantoTempo('2026-11-26T10:20:00Z', agora)).toBe('há 1 h 40 min');
  });
});

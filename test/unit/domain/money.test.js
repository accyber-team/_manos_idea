import { describe, it, expect } from 'vitest';
import { toCents, toUsdCents, formatMoney, formatCompact, formatPct, formatPp } from '../../../src/domain/money.js';

describe('money', () => {
  it('toCents arredonda para centavos inteiros', () => {
    expect(toCents(46428.571428571435)).toBe(4642857);
    expect(toCents(0.005)).toBe(1);
  });
  it('toUsdCents converte BRL pela taxa e mantém USD', () => {
    expect(toUsdCents(58000, 'BRL', { BRL: 5.8 })).toBe(10000);
    expect(toUsdCents(12345, 'USD', {})).toBe(12345);
    expect(() => toUsdCents(1, 'EUR', {})).toThrow(/Câmbio/);
  });
  it('formatação pt-BR', () => {
    expect(formatMoney(123456789, 'USD')).toBe('US$ 1.234.567,89');
    expect(formatMoney(-5000, 'USD')).toBe('-US$ 50,00');
    expect(formatCompact(72730056)).toBe('US$ 727,3 mil');
    expect(formatCompact(152000000)).toBe('US$ 1,52 mi');
    expect(formatCompact(50000)).toBe('US$ 500');
    expect(formatPct(0.2437)).toBe('24,4%');
    expect(formatPct(null)).toBe('—');
    expect(formatPp(0.052)).toBe('+5,2 p.p.');
    expect(formatPp(-0.1)).toBe('−10,0 p.p.');
  });
});

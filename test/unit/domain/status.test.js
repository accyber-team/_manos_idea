import { describe, it, expect } from 'vitest';
import { classifyFill, STATUSES, STATUS_LABELS, isPending } from '../../../src/domain/status.js';

const MAP = { FF00FF00: 'won', FFFFFF00: 'delayed', FFFF0000: 'lost' };

describe('status', () => {
  it('ordem e rótulos pt-BR', () => {
    expect(STATUSES).toEqual(['won', 'delayed', 'lost', 'open']);
    expect(STATUS_LABELS.delayed).toMatch(/DPD/);
  });

  it('cores exatas da configuração', () => {
    expect(classifyFill('FF00FF00', MAP)).toBe('won');
    expect(classifyFill('ffffff00', MAP)).toBe('delayed');
    expect(classifyFill('FFFF0000', MAP)).toBe('lost');
  });

  it('sem preenchimento, branco ou cinza claro = em aberto', () => {
    for (const c of [null, undefined, '', 'FFFFFFFF', 'FFF6F8F9', 'FFD9D9D9']) expect(classifyFill(c, MAP)).toBe('open');
  });

  it('tons próximos são classificados pelo matiz (ex.: verde/amarelo/vermelho do Excel)', () => {
    expect(classifyFill('FF92D050', MAP)).toBe('won');
    expect(classifyFill('FF00B050', MAP)).toBe('won');
    expect(classifyFill('FFFFC000', MAP)).toBe('delayed');
    expect(classifyFill('FFC00000', MAP)).toBe('lost');
    expect(classifyFill('00FF00', MAP)).toBe('won'); // RGB sem alfa
  });

  it('cor sem significado (ex.: azul) retorna null para virar pendência de qualidade', () => {
    expect(classifyFill('FF0000FF', MAP)).toBeNull();
  });

  it('isPending: DPD e em aberto seguem no pipeline', () => {
    expect(isPending('delayed')).toBe(true);
    expect(isPending('open')).toBe(true);
    expect(isPending('won')).toBe(false);
  });
});

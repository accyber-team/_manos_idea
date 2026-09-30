import { describe, it, expect } from 'vitest';
import { normalizeText, keyOf, torreOf, TORRE_LABELS } from '../../../src/domain/normalize.js';

describe('normalize', () => {
  it('normalizeText remove acentos, espaços extras e padroniza caixa', () => {
    expect(normalizeText('  Grupo Águas  do Brasil ')).toBe('GRUPO AGUAS DO BRASIL');
    expect(normalizeText(null)).toBe('');
  });
  it('keyOf ignora pontuação e espaços (CHECK POINT = CHECKPOINT)', () => {
    expect(keyOf('CHECK POINT')).toBe(keyOf('Checkpoint'));
    expect(keyOf('B2W | AMERICANAS')).toBe('B2WAMERICANAS');
  });
  it('torreOf', () => {
    expect(torreOf('SOLUÇÃO ')).toBe('solucao');
    expect(torreOf('SOLUCAO')).toBe('solucao');
    expect(torreOf('SERVIÇO')).toBe('servico');
    expect(torreOf('xyz')).toBe('outro');
    expect(TORRE_LABELS.servico).toBe('Serviço');
  });
});

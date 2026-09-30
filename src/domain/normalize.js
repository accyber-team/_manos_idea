// Normalização de textos da planilha (empresas, parceiros, torres) para agrupar e casar oportunidades.

export const normalizeText = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

/** Chave de comparação: só letras e dígitos ("CHECK POINT" = "CHECKPOINT"). */
export const keyOf = (s) => normalizeText(s).replace(/[^A-Z0-9]/g, '');

export const TORRE_LABELS = { solucao: 'Solução', servico: 'Serviço', outro: 'Outro' };

export function torreOf(s) {
  const k = keyOf(s);
  if (k.startsWith('SOLUC')) return 'solucao';
  if (k.startsWith('SERVIC')) return 'servico';
  return 'outro';
}

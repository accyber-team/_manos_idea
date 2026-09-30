// Status de uma oportunidade, lido da cor de preenchimento da célula VALOR da planilha.
// Mapa exato vem de config/pipeline.json (statusColors); tons próximos caem na classificação por matiz.

export const STATUSES = ['won', 'delayed', 'lost', 'open'];

export const STATUS_LABELS = {
  won: 'Vendido',
  delayed: 'DPD (pedido atrasado)',
  lost: 'Negado / perdido',
  open: 'Em aberto',
};

export const STATUS_SHORT = { won: 'Vendido', delayed: 'DPD', lost: 'Perdido', open: 'Aberto' };

/** Cores de status (reservadas: nunca usadas para séries comuns). Sempre acompanhadas de ícone + rótulo. */
export const STATUS_HEX = { won: '#0ca30c', delayed: '#fab219', lost: '#d03b3b', open: '#9aa0a6' };

export const isPending = (status) => status === 'delayed' || status === 'open';

function toHsl(hex) {
  const n = Number.parseInt(hex, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/**
 * ARGB ("FF00FF00") ou RGB ("00FF00") → 'won' | 'delayed' | 'lost' | 'open' | null.
 * null = cor presente mas sem significado conhecido (vira pendência de qualidade).
 * @param {string|null|undefined} argb
 * @param {Record<string,string>} mapping ARGB maiúsculo → status
 */
export function classifyFill(argb, mapping = {}) {
  if (!argb) return 'open';
  const raw = String(argb).trim().toUpperCase();
  const full = raw.length === 6 ? `FF${raw}` : raw;
  if (mapping[full]) return mapping[full];
  const { h, s, l } = toHsl(full.slice(-6));
  if (s < 0.25 || l > 0.9 || l < 0.12) return 'open';
  if (h < 20 || h >= 340) return 'lost';
  if (h >= 35 && h < 70) return 'delayed';
  if (h >= 75 && h < 165) return 'won';
  return null;
}

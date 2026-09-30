// Funções disponíveis nas views EJS como `h`.
import { formatMoney, formatCompact, formatPct, formatPp } from '../domain/money.js';
import { STATUSES, STATUS_LABELS, STATUS_SHORT, STATUS_HEX } from '../domain/status.js';
import { TORRE_LABELS } from '../domain/normalize.js';
import { GRANULARITIES, monthLabel } from '../domain/periods.js';
import { METHODS } from '../domain/metrics.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Ícone Fomantic por status: a cor nunca aparece sozinha. */
const STATUS_ICONS = { won: 'check circle', delayed: 'clock', lost: 'times circle', open: 'circle outline' };
/** Para indicadores "maior é melhor" (vendido) e "maior é pior" (DPD, perdido). */
const UP_IS_GOOD = { won: true, delayed: false, lost: false, open: null };

export const viewHelpers = {
  esc,
  money: (cents) => formatMoney(cents ?? 0, 'USD'),
  compact: (cents) => formatCompact(cents ?? 0, 'USD'),
  pct: formatPct,
  pp: formatPp,
  statuses: STATUSES,
  statusLabel: (s) => STATUS_LABELS[s] ?? s,
  statusShort: (s) => STATUS_SHORT[s] ?? s,
  statusIcon: (s) => STATUS_ICONS[s],
  statusHex: STATUS_HEX,
  torreLabel: (t) => TORRE_LABELS[t] ?? t,
  torres: TORRE_LABELS,
  monthLabel,
  months: Array.from({ length: 12 }, (_, i) => i + 1),
  granularities: GRANULARITIES,
  methods: METHODS,
  /** Classe de tendência de um delta: good | bad | neutral. */
  trend(value, status = 'won') {
    if (value == null || value === 0 || UP_IS_GOOD[status] == null) return 'neutral';
    return (value > 0) === UP_IS_GOOD[status] ? 'good' : 'bad';
  },
  signedPct(x) {
    if (x == null || Number.isNaN(x)) return '—';
    return `${x > 0 ? '+' : x < 0 ? '−' : ''}${formatPct(Math.abs(x))}`;
  },
  dateTime: (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''),
  qs: (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString(),
  /** JSON seguro dentro de <script type="application/json">. */
  json: (v) => JSON.stringify(v).replace(/</g, '\\u003c'),
};

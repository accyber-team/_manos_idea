// Schema de config/pipeline.json (zod). Cores em ARGB maiúsculo → status.
import { z } from 'zod';

const ARGB = z.string().regex(/^[0-9A-Fa-f]{8}$/, 'cor ARGB com 8 dígitos hex (ex.: FF00FF00)').transform((s) => s.toUpperCase());
const STATUS = z.enum(['won', 'delayed', 'lost', 'open']);

export const pipelineConfigSchema = z.object({
  baseYear: z.number().int().min(2000).max(2100),
  compareYears: z.tuple([z.number().int(), z.number().int()]),
  statusColors: z.record(ARGB, STATUS),
  fxRates: z.record(z.string(), z.number().positive()).default({}),
  sheetOverrides: z.record(z.string(), z.object({
    defaultStatus: STATUS.optional(),
    currency: z.enum(['USD', 'BRL']).optional(),
  })).default({}),
  ignoreSheets: z.array(z.string()).default([]),
  simulation: z.object({
    runs: z.number().int().min(100).max(50000).default(5000),
    seed: z.number().int().default(42),
  }).default({ runs: 5000, seed: 42 }),
});

export function parsePipelineConfig(raw) {
  const r = pipelineConfigSchema.safeParse(raw);
  if (!r.success) throw new Error(`config/pipeline.json inválido: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return r.data;
}

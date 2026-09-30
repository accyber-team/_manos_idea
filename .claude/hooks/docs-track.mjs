#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit|NotebookEdit): registra o arquivo alterado e regenera docs/generated/*.
// Nunca falha a ferramenta: qualquer erro vira aviso em stderr com exit 0.
import { readHookInput, projectRoot, toRelative, classify, recordChange, needsRegeneration } from './docs-lib.mjs';

try {
  const input = await readHookInput();
  const root = projectRoot(input);
  const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  const rel = toRelative(root, file);
  const kind = classify(rel);
  if (kind !== 'other') recordChange(root, input.session_id, kind, rel);
  if (needsRegeneration(rel)) {
    const { generate } = await import(new URL('../../scripts/docs-generate.mjs', import.meta.url));
    generate(root);
  }
} catch (err) {
  process.stderr.write(`[docs-track] aviso: ${err.message}\n`);
}
process.exit(0);

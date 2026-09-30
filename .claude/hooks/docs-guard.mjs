#!/usr/bin/env node
// Stop: impede o fim do turno se houve mudança de código sem atualização de documentação.
// stop_hook_active=true significa que já bloqueamos uma vez neste ciclo → libera para evitar loop.
import { readHookInput, projectRoot, loadState, resetState, evaluate, docsModifiedSince } from './docs-lib.mjs';

try {
  const input = await readHookInput();
  const root = projectRoot(input);
  const state = loadState(root, input.session_id);
  const docs = [...state.docs, ...docsModifiedSince(root, state.since)];
  const result = evaluate({ code: state.code, docs });
  if (result.block && !input.stop_hook_active) {
    process.stdout.write(JSON.stringify({ decision: 'block', reason: result.reason }));
  } else {
    resetState(root, input.session_id);
  }
} catch (err) {
  process.stderr.write(`[docs-guard] aviso: ${err.message}\n`);
}
process.exit(0);

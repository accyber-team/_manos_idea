#!/usr/bin/env node
// Stop: se o servidor local está no ar e src/, config/ ou package.json mudaram depois
// que ele subiu, reinicia (`node src/server.js`, destacado, log em .claude/state/server.log).
// Não inicia o servidor se ele não estiver rodando. Nunca bloqueia o turno.
import { execFileSync, spawn } from 'node:child_process';
import { openSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { changedSince, parseLstart, isLauncher } from './server-lib.mjs';

const PORT = Number(process.env.PORT || 3000);
const sh = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8' }).trim(); } catch { return ''; } };
const listeningPid = () => sh('lsof', ['-nP', '-t', `-iTCP:${PORT}`, '-sTCP:LISTEN']).split('\n')[0] || null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (msg) => process.stdout.write(JSON.stringify({ systemMessage: msg }));

async function waitFor(pred, timeoutMs) {
  for (let t = 0; t < timeoutMs; t += 200) { if (pred()) return true; await wait(200); }
  return pred();
}

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const pid = listeningPid();
  if (!pid) process.exit(0);
  const started = parseLstart(sh('ps', ['-o', 'lstart=', '-p', pid]));
  const changed = Number.isNaN(started) ? ['?'] : changedSince(root, started);
  if (changed.length === 0) process.exit(0);

  const ppid = sh('ps', ['-o', 'ppid=', '-p', pid]);
  const parentCmd = ppid ? sh('ps', ['-o', 'command=', '-p', ppid]) : '';
  const victims = isLauncher(parentCmd) ? [ppid, pid] : [pid];
  for (const p of victims) { try { process.kill(Number(p), 'SIGTERM'); } catch { /* já saiu */ } }
  if (!(await waitFor(() => !listeningPid(), 5000))) {
    for (const p of victims) { try { process.kill(Number(p), 'SIGKILL'); } catch { /* já saiu */ } }
    await waitFor(() => !listeningPid(), 2000);
  }

  mkdirSync(join(root, '.claude', 'state'), { recursive: true });
  const log = openSync(join(root, '.claude', 'state', 'server.log'), 'a');
  spawn(process.execPath, ['src/server.js'], { cwd: root, detached: true, stdio: ['ignore', log, log], env: process.env }).unref();

  const up = await waitFor(() => !!listeningPid(), 10000);
  say(up
    ? `Servidor reiniciado em http://127.0.0.1:${PORT} (${changed.length} arquivo(s) alterado(s)).`
    : `Falha ao reiniciar o servidor na porta ${PORT}: veja .claude/state/server.log.`);
} catch (err) {
  process.stderr.write(`[server-restart] aviso: ${err.message}\n`);
}
process.exit(0);

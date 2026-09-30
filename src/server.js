// Ponto de entrada HTTP: `npm start` (ou `npm run dev` com --watch). Variáveis: PORT, HOST e as de src/compose.js.
import { createApp } from './http/app.js';
import { composeService } from './compose.js';

const PORT = Number(process.env.PORT || 3737);
const HOST = process.env.HOST || '127.0.0.1';

const service = composeService(process.env);
const app = createApp({ service });

const server = app.listen(PORT, HOST, async () => {
  console.log(`Análise de Pipeline em http://${HOST}:${PORT}`);
  try {
    const ov = await service.overview();
    console.log(`Fonte (${ov.source.kind}): ${ov.source.path} · ${ov.snapshots.length} aba(s) mensal(is) · ${ov.dealCount} oportunidade(s)`);
  } catch (err) {
    console.warn(`Aviso: ${err.message} (defina PIPELINE_DIR ou PIPELINE_FILE)`);
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}

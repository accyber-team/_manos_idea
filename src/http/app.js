// createApp(deps): Express 5 + EJS + Fomantic-UI + ECharts (ARCHITECTURE §1). Dependências injetadas para testes.
import express from 'express';
import ejs from 'ejs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dashboardRoutes } from './routes/dashboard.js';
import { apiRoutes } from './routes/api.js';
import { errorHandler } from './errors.js';
import { viewHelpers } from './view-helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));

export function createApp({ service }) {
  const app = express();
  app.disable('x-powered-by');
  app.engine('ejs', ejs.renderFile);
  app.set('view engine', 'ejs');
  app.set('views', join(here, 'views'));
  app.locals.h = viewHelpers;

  app.use(express.urlencoded({ extended: false }));
  app.use('/vendor/fomantic', express.static(pkgDir('fomantic-ui-css')));
  app.use('/vendor/jquery', express.static(join(pkgDir('jquery'), 'dist')));
  app.use('/vendor/echarts', express.static(join(pkgDir('echarts'), 'dist')));
  app.use('/static', express.static(join(here, 'public')));

  app.get('/health', async (req, res) => {
    try {
      const ov = await service.overview();
      res.json({ ok: true, source: ov.source.name, snapshots: ov.snapshots.length, deals: ov.dealCount });
    } catch (err) {
      res.status(503).json({ ok: false, message: err.message });
    }
  });
  // Cabeçalho de todas as páginas: arquivo lido e contagem de pendências (null se a planilha não estiver disponível).
  app.use(async (req, res, next) => {
    res.locals.overview = await service.overview().catch(() => null);
    res.locals.path = req.path;
    next();
  });
  app.use('/api', apiRoutes(service));
  app.use('/', dashboardRoutes(service));
  app.use((req, res) => res.status(404).render('error', { status: 404, message: 'Página não encontrada' }));
  app.use(errorHandler);
  return app;
}

// API JSON (mesmos parâmetros das páginas) para integrações e relatórios automatizados.
// @mount /api
import { Router } from 'express';

export function apiRoutes(service) {
  const r = Router();
  r.get('/visao-geral', async (req, res) => res.json(await service.overview()));
  r.get('/comparativo', async (req, res) => res.json(await service.comparison(req.query)));
  r.get('/quebras', async (req, res) => res.json(await service.breakdowns(req.query)));
  r.get('/oportunidades', async (req, res) => res.json(await service.deals(req.query)));
  r.get('/simulacao', async (req, res) => res.json(await service.simulation(req.query)));
  r.get('/qualidade', async (req, res) => res.json(await service.issues()));
  return r;
}

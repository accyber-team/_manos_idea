// Páginas: comparativo (início), oportunidades, simulação, qualidade dos dados; recarregar e exportar XLSX.
// @mount /
import { Router } from 'express';

export function dashboardRoutes(service) {
  const r = Router();

  r.get('/', async (req, res) => {
    const [comparison, breakdowns] = await Promise.all([service.comparison(req.query), service.breakdowns(req.query)]);
    res.render('dashboard', { title: 'Comparativo', comparison, breakdowns, query: req.query });
  });

  r.get('/oportunidades', async (req, res) => {
    res.render('deals', { title: 'Oportunidades', result: await service.deals(req.query), query: req.query });
  });

  r.get('/simulacao', async (req, res) => {
    res.render('simulation', { title: 'Simulação', sim: await service.simulation(req.query), query: req.query });
  });

  r.get('/qualidade', async (req, res) => {
    res.render('quality', { title: 'Qualidade dos dados', issues: await service.issues() });
  });

  r.post('/recarregar', async (req, res) => {
    await service.reload();
    const back = typeof req.body?.back === 'string' && req.body.back.startsWith('/') && !req.body.back.startsWith('//') ? req.body.back : '/';
    res.redirect(303, back);
  });

  r.get('/exportar.xlsx', async (req, res) => {
    const buf = await service.exportWorkbook(req.query);
    const stamp = new Date().toISOString().slice(0, 10);
    res.attachment(`analise-pipeline-${stamp}.xlsx`);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buf);
  });

  return r;
}

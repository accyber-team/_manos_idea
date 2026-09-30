// Mapeia erros de aplicação para HTTP: 422 validação, 503 planilha indisponível.
import { ValidationError, SourceUnavailableError } from '../application/errors.js';

function statusOf(err) {
  if (err instanceof ValidationError) return 422;
  if (err instanceof SourceUnavailableError) return 503;
  return 500;
}

export function errorHandler(err, req, res, _next) {
  const status = statusOf(err);
  if (status === 500) console.error(err);
  const message = status === 500 ? 'Erro interno' : err.message;
  const wantsHtml = !req.originalUrl.startsWith('/api') && req.accepts(['html', 'json']) === 'html';
  if (wantsHtml) return res.status(status).render('error', { status, message, errors: err.errors ?? [] });
  return res.status(status).json({ message, ...(err.errors ? { errors: err.errors } : {}) });
}

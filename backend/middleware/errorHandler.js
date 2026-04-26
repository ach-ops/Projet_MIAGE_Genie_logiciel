import { logger } from '../utils/logger.js';

/**
 * Middleware de gestion d'erreurs.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Erreur interne du serveur';

  logger.error(`[${req.method}] ${req.path} → ${status} ${message}`, {
    stack: err.stack,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * Wrapper pour éviter le try/catch boilerplate dans les controllers async.
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

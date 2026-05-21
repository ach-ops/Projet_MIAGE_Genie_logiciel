import { logger } from '../utils/logger.js';

/**
 * Middleware de logging des requêtes HTTP.
 * Enregistre méthode, path, status et durée après chaque réponse.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    // 5xx → error, 4xx → warn, reste → info
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](
      `${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`,
      { ip: req.ip }
    );
  });

  next();
}

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getDelayStats } from '../services/mongo.service.js';
import { getRouteInfo } from '../services/gtfs.service.js';

const router = Router();

/**
 * GET /api/stats/delays
 *
 * Retourne les statistiques de retard calculées sur les 3 dernières heures :
 * - moyenne par ligne (avec nombre d'échantillons)
 * - moyenne globale réseau
 */
router.get('/delays', asyncHandler(async (_req, res) => {
  const { lines, globalAverage } = await getDelayStats();

  // On ajoute le nom lisible et la couleur de chaque ligne depuis les données GTFS statiques
  const enrichedLines = lines
    .map(l => {
      const info = getRouteInfo(l.routeId);
      return {
        routeId:   l.routeId,
        routeName: info?.routeName ?? l.routeId,
        color:     info?.color     ?? '#888888',
        avgDelay:  l.avgDelay,
        samples:   l.samples,
      };
    })
    .sort((a, b) => a.routeName.localeCompare(b.routeName));

  res.json({ lines: enrichedLines, globalAverage });
}));

export default router;

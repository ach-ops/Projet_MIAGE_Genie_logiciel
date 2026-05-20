/**
 * @swagger
 * tags:
 *   name: Transport
 *   description: Horaires, lignes et arrêts STAN Nancy
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateGtfsParams } from '../middleware/validate.js';
import {
  listStops,
  listVelibStations,
  listAllRoutes,
  listRoutesByStop,
  listDirections,
  listDirectionsForRoute,
  listArrivals,
  listAllArrivals,
  listShape,
  listRouteStops,
} from '../controllers/transport.controllers.js';
import { getAverageDelay, getDelaysByRoute } from '../services/mongo.service.js';
import { getRouteInfo } from '../services/gtfs.service.js';

const router = Router();

// ─── Retards ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/delays/average:
 *   get:
 *     summary: Retard moyen global (toutes lignes confondues)
 *     tags: [Transport]
 *     responses:
 *       200:
 *         description: Retard moyen en minutes (null si aucune donnée)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 averageDelayMin:
 *                   type: number
 *                   nullable: true
 *                   example: 2.3
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/delays/average', asyncHandler(async (_req, res) => {
  const avg = await getAverageDelay();
  res.json({ averageDelayMin: avg });
}));

/**
 * @swagger
 * /api/delays/by-route:
 *   get:
 *     summary: Retard moyen par ligne de bus
 *     tags: [Transport]
 *     responses:
 *       200:
 *         description: Tableau des retards moyens par ligne, trié par nom
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DelayByRoute'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/delays/by-route', asyncHandler(async (_req, res) => {
  const delays = await getDelaysByRoute();
  const enriched = delays
    .map(d => {
      const info = getRouteInfo(d.routeId);
      return {
        routeId:         d.routeId,
        routeName:       info?.routeName ?? d.routeId,
        color:           info?.color     ?? '#888888',
        averageDelayMin: d.averageDelayMin,
      };
    })
    .sort((a, b) => a.routeName.localeCompare(b.routeName));
  res.json(enriched);
}));

// ─── Arrêts ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/stops:
 *   get:
 *     summary: Liste tous les arrêts GTFS
 *     tags: [Transport]
 *     responses:
 *       200:
 *         description: Tableau de tous les arrêts du réseau
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Stop'
 */
router.get('/stops', listStops);

/**
 * @swagger
 * /api/velib/stations:
 *   get:
 *     summary: Stations Vélib avec disponibilités temps réel (GBFS)
 *     tags: [Transport]
 *     parameters:
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: Force le rechargement du cache
 *     responses:
 *       200:
 *         description: Liste des stations avec disponibilités. `degraded=true` si l'API GBFS est indisponible.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 42
 *                 degraded:
 *                   type: boolean
 *                   example: false
 *                 stations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VelibStation'
 */
router.get('/velib/stations', asyncHandler(listVelibStations));

/**
 * @swagger
 * /api/stops/{stopId}/routes:
 *   get:
 *     summary: Lignes desservant un arrêt
 *     tags: [Transport]
 *     parameters:
 *       - in: path
 *         name: stopId
 *         required: true
 *         schema:
 *           type: string
 *         example: NANCY_001
 *         description: Identifiant GTFS de l'arrêt
 *     responses:
 *       200:
 *         description: Tableau des lignes actives à cet arrêt
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Route'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/stops/:stopId/routes', validateGtfsParams('stopId'), listRoutesByStop);

/**
 * @swagger
 * /api/stops/{stopId}/routes/{routeId}/directions:
 *   get:
 *     summary: Directions disponibles pour une ligne à un arrêt
 *     tags: [Transport]
 *     parameters:
 *       - in: path
 *         name: stopId
 *         required: true
 *         schema:
 *           type: string
 *         example: NANCY_001
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *         example: STAN_1
 *     responses:
 *       200:
 *         description: Tableau des directions disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Direction'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/stops/:stopId/routes/:routeId/directions',
  validateGtfsParams('stopId', 'routeId'), listDirections);

/**
 * @swagger
 * /api/stops/{stopId}/routes/{routeId}/directions/{directionId}/arrivals:
 *   get:
 *     summary: Prochains passages temps réel
 *     tags: [Transport]
 *     parameters:
 *       - in: path
 *         name: stopId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: directionId
 *         required: true
 *         schema:
 *           type: string
 *         example: "0"
 *     responses:
 *       200:
 *         description: Prochains passages avec source
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ArrivalsFallback'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  '/stops/:stopId/routes/:routeId/directions/:directionId/arrivals',
  validateGtfsParams('stopId', 'routeId', 'directionId'),
  asyncHandler(listArrivals)
);

/**
 * @swagger
 * /api/stops/{stopId}/routes/{routeId}/directions/{directionId}/all-arrivals:
 *   get:
 *     summary: Passages temps réel ET théoriques
 *     tags: [Transport]
 *     parameters:
 *       - in: path
 *         name: stopId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: directionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Temps réel et théoriques fusionnés avec statut
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AllArrivals'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  '/stops/:stopId/routes/:routeId/directions/:directionId/all-arrivals',
  validateGtfsParams('stopId', 'routeId', 'directionId'),
  asyncHandler(listAllArrivals)
);

// ─── Lignes ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/routes:
 *   get:
 *     summary: Toutes les lignes de bus du réseau STAN
 *     tags: [Transport]
 *     responses:
 *       200:
 *         description: Tableau de toutes les lignes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Route'
 */
router.get('/routes', listAllRoutes);

/**
 * @swagger
 * /api/routes/{routeId}/directions:
 *   get:
 *     summary: Toutes les directions d'une ligne (ex. direction 0 aller, 1 retour)
 *     tags: [Transport]
 *     parameters:
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *         example: STAN_1
 *     responses:
 *       200:
 *         description: Directions de la ligne
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Direction'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/routes/:routeId/directions', validateGtfsParams('routeId'), listDirectionsForRoute);

/**
 * @swagger
 * /api/routes/{routeId}/directions/{directionId}/shape:
 *   get:
 *     summary: Tracé géographique GPS d'une ligne pour une direction
 *     tags: [Transport]
 *     parameters:
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: directionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Points GPS du tracé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 points:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ShapePoint'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/routes/:routeId/directions/:directionId/shape',
  validateGtfsParams('routeId', 'directionId'), listShape);

/**
 * @swagger
 * /api/routes/{routeId}/directions/{directionId}/stops:
 *   get:
 *     summary: Arrêts ordonnés d'une ligne pour une direction
 *     tags: [Transport]
 *     parameters:
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: directionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Arrêts ordonnés par séquence
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stops:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RouteStop'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.get('/routes/:routeId/directions/:directionId/stops',
  validateGtfsParams('routeId', 'directionId'), listRouteStops);


export default router;

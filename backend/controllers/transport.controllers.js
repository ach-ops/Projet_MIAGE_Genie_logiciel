/**
 * @swagger
 * tags:
 *   name: Transport
 *   description: Opérations sur les transports
 */
import { Router } from "express";
import {
  listStops,
  listRoutes,
  listDirections,
  listArrivals,
  listAllArrivals,
  listAllRoutes,
  listDirectionsForRoute,
} from "../services/transport.service.js";

const router = Router();
/**
 * @swagger
 * /api/stops:
 *   get:
 *     summary: Liste tous les arrêts
 *     tags: [Transport]
 *     responses:
 *       200:
 *         description: Liste des arrêts
 */
router.get("/stops", listStops);

/**
 * @swagger
 * /api/stops/{stopId}/routes:
 *   get:
 *     summary: Liste les lignes desservant un arrêt
 *     tags: [Transport]
 *     parameters:
 *       - in: path
 *         name: stopId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'arrêt
 *     responses:
 *       200:
 *         description: Liste des lignes
 */
router.get("/stops/:stopId/routes", listRoutes);

/**
 * @swagger
 * /api/stops/{stopId}/routes/{routeId}/directions:
 *   get:
 *     summary: Liste les directions d'une ligne à un arrêt
 *     tags: [Transport]
 *     parameters:
 *       - in: path
 *         name: stopId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'arrêt
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la ligne
 *     responses:
 *       200:
 *         description: Liste des directions
 */
router.get("/stops/:stopId/routes/:routeId/directions", listDirections);

/**
 * @swagger
 * /api/stops/{stopId}/routes/{routeId}/directions/{directionId}/arrivals:
 *   get:
 *     summary: Liste les prochains passages en temps réel
 *     tags: [Transport]
 *     parameters:
 *       - in: path
 *         name: stopId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'arrêt
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la ligne
 *       - in: path
 *         name: directionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la direction
 *     responses:
 *       200:
 *         description: Liste des arrivées en temps réel
 */
router.get(
    "/stops/:stopId/routes/:routeId/directions/:directionId/arrivals",
    listArrivals
);

/**
 * @swagger
 * /api/stops/{stopId}/routes/{routeId}/directions/{directionId}/all-arrivals:
 *   get:
 *     summary: Arrivées temps réel et théoriques pour un arrêt
 *     tags: [Transport]
 *     parameters:
 *       - in: path
 *         name: stopId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'arrêt
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la ligne
 *       - in: path
 *         name: directionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la direction
 *     responses:
 *       200:
 *         description: Arrivées temps réel et théoriques
 */
router.get("/stops/:stopId/routes/:routeId/directions/:directionId/all-arrivals", listAllArrivals);

/**
 * @swagger
 * /api/routes/{routeId}/directions/{directionId}/shape:
 *   get:
 *     summary: Retourne les points de la forme géographique d'une ligne
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
 *         description: Liste de points [lat, lon]
 */
// router.get("/routes/:routeId/directions/:directionId/shape", listShape); // en cours de développement, shape pas encore traité dans le service

/**
 * @swagger
 * /api/routes:
 *   get:
 *     summary: Liste toutes les lignes de bus
 *     tags: [Transport]
 *     responses:
 *       200:
 *         description: Liste des lignes
 */
router.get("/routes", listAllRoutes);

/**
 * @swagger
 * /api/routes/{routeId}/directions:
 *   get:
 *     summary: Liste les directions d'une ligne
 *     tags: [Transport]
 *     parameters:
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Liste des directions
 */
router.get("/routes/:routeId/directions", listDirectionsForRoute);


export default router;
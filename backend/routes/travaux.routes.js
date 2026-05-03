/**
 * @swagger
 * tags:
 *   name: Travaux
 *   description: Incidents et travaux en temps réel
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { listIncidents } from '../controllers/travaux.controllers.js';

const router = Router();

/**
 * @swagger
 * /api/travaux/incidents:
 *   get:
 *     summary: Incidents et travaux en temps réel
 *     tags: [Travaux]
 *     responses:
 *       200:
 *         description: Données brutes du flux CIFS (incidents, travaux, déviations)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 incidents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:          { type: string }
 *                       type:        { type: string, example: ROAD_CLOSED }
 *                       description: { type: string }
 *                       location:
 *                         type: object
 *                         properties:
 *                           lat: { type: number }
 *                           lon: { type: number }
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/incidents', asyncHandler(listIncidents));

export default router;

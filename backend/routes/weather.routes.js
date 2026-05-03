/**
 * @swagger
 * tags:
 *   name: Météo
 *   description: Données météo Nancy
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getWeather } from '../controllers/weather.controller.js';

const router = Router();

/**
 * @swagger
 * /api/weather:
 *   get:
 *     summary: Météo actuelle + prévisions 48h pour Nancy (WeatherAPI.com)
 *     tags: [Météo]
 *     responses:
 *       200:
 *         description: Météo actuelle et prévisions horaires sur 2 jours
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 current:
 *                   type: object
 *                   properties:
 *                     temp_c:    { type: number, example: 14.5 }
 *                     condition: { type: object, properties: { text: { type: string }, icon: { type: string } } }
 *                     wind_kph:  { type: number, example: 18 }
 *                     humidity:  { type: integer, example: 62 }
 *                 forecast:
 *                   type: object
 *                   properties:
 *                     forecastday:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           hour:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 time:      { type: string, example: '2026-04-19 14:00' }
 *                                 temp_c:    { type: number }
 *                                 condition: { type: object }
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/', asyncHandler(getWeather));

export default router;

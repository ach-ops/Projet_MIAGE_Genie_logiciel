/**
 * @swagger
 * tags:
 *   name: Itinéraire
 *   description: Calcul d'itinéraire multimodal (marche + bus)
 */
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getItinerary, getSuggestions } from '../controllers/itinerary.controller.js';

const router = Router();

/**
 * @swagger
 * /api/itinerary/suggest:
 *   get:
 *     summary: Autocomplétion d'adresse (API adresse.data.gouv.fr, sans clé)
 *     tags: [Itinéraire]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Saisie partielle de l'adresse (min 2 caractères, max 6 suggestions)
 *         example: Place Stan
 *     responses:
 *       200:
 *         description: Liste de suggestions (tableau vide si query trop courte ou caractères invalides)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Suggestion'
 */
router.get('/suggest', asyncHandler(getSuggestions));

/**
 * @swagger
 * /api/itinerary:
 *   get:
 *     summary: Calcule un itinéraire multimodal (marche + bus) entre deux adresses de Nancy
 *     tags: [Itinéraire]
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           maxLength: 200
 *         description: Adresse de départ
 *         example: Place Stanislas Nancy
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           maxLength: 200
 *         description: Adresse d'arrivée
 *         example: Gare de Nancy
 *     responses:
 *       200:
 *         description: Itinéraire avec option marche seule + jusqu'à 5 options bus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 from:
 *                   type: object
 *                   properties:
 *                     address:     { type: string }
 *                     displayName: { type: string }
 *                     lat:         { type: number }
 *                     lon:         { type: number }
 *                 to:
 *                   type: object
 *                   properties:
 *                     address:     { type: string }
 *                     displayName: { type: string }
 *                     lat:         { type: number }
 *                     lon:         { type: number }
 *                 walkingOnly:
 *                   $ref: '#/components/schemas/WalkingOnly'
 *                 options:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ItineraryOption'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/',        asyncHandler(getItinerary));

export default router;

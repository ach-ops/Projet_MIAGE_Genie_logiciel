/**
 * @swagger
 * tags:
 *   name: Travaux
 *   description: Informations travaux en temps réel
 */

import { Router } from "express"
import { listIncidents } from "../services/travaux.service.js"

const router = Router()

/**
 * @swagger
 * /api/travaux/incidents:
 *   get:
 *     summary: Liste les incidents travaux
 *     tags: [Travaux]
 *     responses:
 *       200:
 *         description: Liste des incidents
 */
router.get("/incidents", listIncidents)

export default router
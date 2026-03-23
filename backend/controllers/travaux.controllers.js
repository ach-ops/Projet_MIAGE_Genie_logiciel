import { Router } from "express"
import { listIncidents } from "../services/travaux.service.js"

const router = Router()


router.get("/incidents", listIncidents)

export default router
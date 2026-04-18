import cron from "node-cron"
import { computeDelays } from "../services/delay.service.js"

export function startCron() {
  cron.schedule("*/30 * * * *", () => computeDelays())
}

import cron from "node-cron"
import { computeDelays } from "../services/delay.service.js"

export function startCron() {

  console.log("Cron initialisé")

  cron.schedule("*/30 * * * *", async () => {
    console.log("⏱ Cron lancé :", new Date().toLocaleTimeString())

    try {
      await computeDelays()
      console.log("Retards calculés et stockés")
    } catch (err) {
      console.error("Erreur cron :", err)
    }
  })
}
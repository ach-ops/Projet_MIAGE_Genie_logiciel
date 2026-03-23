import { getTheoreticalArrivals } from "./gtfs.service.js"
import { getRealtimeArrivals } from "./realtime.service.js"
import { getAllTerminals, getRouteInfo } from "./gtfs.service.js"
import { saveDelay } from "./mongo.service.js"



export async function computeDelays() {

  const terminals = getAllTerminals()

  for (const terminal of terminals) {

    const theoretical = getTheoreticalArrivals(
      terminal.stopId,
      terminal.routeId,
      terminal.directionId
    )

    const realtime = await getRealtimeArrivals(
      terminal.stopId,
      terminal.routeId,
      terminal.directionId
    )

    if (!theoretical.length || !realtime.length) continue

    let delay =
      realtime[0].arrivalInMin - theoretical[0].arrivalInMin

    // On ignore les retards trop longs (bus bloqué ou données erronées)
    if (Math.abs(delay) > 30) {
        delay = null
    }

    // Récupérer les infos de la route pour l'affichage
    const routeInfo = getRouteInfo(terminal.routeId)

    await saveDelay({
      routeId: terminal.routeId,
      terminal: terminal.name,
      delay,
      routeName: routeInfo?.routeName,
      color: routeInfo?.color,
    })
  }
}
import { getTheoreticalArrivals, getAllTerminals } from './gtfs.service.js';
import { getRealtimeArrivals } from './realtime.service.js';
import { saveDelay } from './mongo.service.js';

export async function computeDelays() {
  // Les terminus sont les points de mesure : le retard y est le plus fiable
  const terminals = getAllTerminals();

  for (const terminal of terminals) {
    const theoretical = getTheoreticalArrivals(
      terminal.stopId,
      terminal.routeId,
      terminal.directionId
    );

    let realtime;
    try {
      realtime = await getRealtimeArrivals(
        terminal.stopId,
        terminal.routeId,
        terminal.directionId
      );
    } catch {
      // Flux temps réel indisponible pour ce terminus -> on passe au suivant
      continue;
    }

    // Pas de passage ni théorique ni temps réel -> aucun retard mesurable pour ce terminus
    if (!theoretical.length || !realtime.length) continue;

    // On compare le prochain passage temps réel au prochain passage théorique au terminus
    let delay = realtime[0].arrivalInMin - theoretical[0].arrivalInMin;

    // Valeur aberrante : probablement un trajet mal aligné ou un bug du flux
    if (Math.abs(delay) > 30) {
      delay = null;
    }

    await saveDelay({
      routeId:  terminal.routeId,
      terminal: terminal.name,
      delay,
    });
  }
}

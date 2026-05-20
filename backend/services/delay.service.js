import { getTheoreticalArrivals, getAllTerminals } from './gtfs.service.js';
import { getRealtimeArrivals } from './realtime.service.js';
import { saveDelay } from './mongo.service.js';

export async function computeDelays() {
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
      continue;
    }

    if (!theoretical.length || !realtime.length) continue;

    let delay = realtime[0].arrivalInMin - theoretical[0].arrivalInMin;

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

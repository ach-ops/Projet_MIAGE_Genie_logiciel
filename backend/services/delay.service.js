/**
 * Service de calcul des retards des bus.
 *
 * Pour chaque terminal de chaque ligne, on compare :
 *  - l'heure théorique (GTFS statique, horaires prévus)
 *  - l'heure temps réel (GTFS-RT)
 *
 * La différence (en minutes) est le retard. On l'enregistre dans MongoDB
 * pour calculer ensuite le retard moyen par ligne.
 */
import { getTheoreticalArrivals, getAllTerminals, getRouteInfo } from './gtfs.service.js';
import { getRealtimeArrivals } from './realtime.service.js';
import { saveDelay } from './mongo.service.js';
import { logger } from '../utils/logger.js';

// On ignore les retards > 30 min
// ce ne sont pas des données fiables pour calculer une moyenne.
const MAX_PLAUSIBLE_DELAY_MIN = 30;

export async function computeDelays() {
  // getAllTerminals() retourne le dernier arrêt de chaque ligne + direction.
  const terminals = getAllTerminals();
  logger.info(`Calcul des retards pour ${terminals.length} terminaux`);

  let saved   = 0;
  let skipped = 0;

  for (const terminal of terminals) {
    // Récupère les prochains passages théoriques depuis le GTFS statique
    const theoretical = getTheoreticalArrivals(terminal.stopId, terminal.routeId, terminal.directionId);

    // Récupère les passages temps réel depuis GTFS-RT
    let realtime;
    try {
      realtime = await getRealtimeArrivals(terminal.stopId, terminal.routeId, terminal.directionId);
    } catch (err) {
      // Si GTFS-RT est injoignable pour ce terminal, on passe au suivant
      logger.debug('Temps réel indisponible pour terminal', { terminal: terminal.name, error: err.message });
      skipped++;
      continue;
    }

    // Si l'un des deux est vide, impossible de calculer un retard
    if (!theoretical.length || !realtime.length) {
      skipped++;
      continue;
    }

    // Le retard = écart entre le premier passage GTFS-RT et le premier passage théorique
    let delay = realtime[0].arrivalInMin - theoretical[0].arrivalInMin;

    // Retard > 30 min : données probablement erronées
    if (Math.abs(delay) > MAX_PLAUSIBLE_DELAY_MIN) {
      logger.debug(`Retard ignoré (${delay} min, hors seuil)`, { routeId: terminal.routeId, terminal: terminal.name });
      delay = null;
    }

    const routeInfo = getRouteInfo(terminal.routeId);

    // Sauvegarde dans MongoDB (upsert : met à jour si le document existe déjà)
    await saveDelay({
      routeId:   terminal.routeId,
      terminal:  terminal.name,
      delay,
      routeName: routeInfo?.routeName,
      color:     routeInfo?.color,
    });

    saved++;
  }

  logger.info(`Retards calculés : ${saved} sauvegardés, ${skipped} ignorés`);
}

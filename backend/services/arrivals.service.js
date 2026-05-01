/**
 * Service des passages (horaires).
 *
 * - getAllArrivals : retourne les passages temps réel ET théoriques
 * - getArrivalsRealtime : retourne les prochains passages, avec bascule sur le théorique si besoin
 */
import {
  getTheoreticalArrivals,
  getStopName,
  getDirectionName,
  getDirections,
} from './gtfs.service.js';
import { getRealtimeArrivals } from './realtime.service.js';
import { logger } from '../utils/logger.js';

/**
 * Retourne les passages temps réel ET théoriques pour un arrêt/ligne/direction.
 * Si le temps réel est indisponible, realtimeStatus l'indique.
 */
export async function getAllArrivals(stopId, routeId, directionId) {
  const stopName      = getStopName(stopId);
  const directionName = getDirectionName(stopId, routeId, directionId);
  const theoretical   = getTheoreticalArrivals(stopId, routeId, directionId);

  let realtime       = [];
  let realtimeStatus = 'ok';
  let realtimeError  = null;

  try {
    realtime = await getRealtimeArrivals(stopId, routeId, directionId);
    if (realtime.length === 0) {
      realtimeStatus = 'empty';
      logger.debug('Temps réel vide, fallback théorique', { stopId, routeId, directionId });
    }
  } catch (err) {
    realtimeStatus = 'error';
    realtimeError  = err.message;
    logger.warn('Temps réel indisponible, fallback théorique', { stopId, routeId, error: err.message });
  }

  return {
    stopId,
    stopName,
    routeId,
    directionId,
    directionName,
    realtime,
    theoretical,
    realtimeStatus,
    realtimeError,
    useTheoretical: realtimeStatus !== 'ok' || realtime.length === 0, // indique au front d'afficher les horaires théoriques
  };
}

/**
 * Retourne les prochains passages pour un arrêt/ligne/direction.
 * Priorité au temps réel ; bascule sur les horaires théoriques si indisponible.
 * Le champ `source` indique quelle source est utilisée.
 */
export async function getArrivalsRealtime(stopId, routeId, directionId) {
  const stopName  = getStopName(stopId);
  const directions = getDirections(stopId, routeId);
  // Nom de la direction (ex : "Brabois") pour l'affichage
  const direction = directions.find(d => String(d.directionId) === String(directionId));

  try {
    const arrivals = await getRealtimeArrivals(stopId, routeId, directionId);
    return {
      stopName,
      direction: direction?.label || null,
      arrivals,
      source: 'realtime',
    };
  } catch (err) {
    logger.warn('Temps réel échoué, fallback théorique', { stopId, routeId, error: err.message });
    const theoretical = getTheoreticalArrivals(stopId, routeId, directionId);
    return {
      stopName,
      direction: direction?.label || null,
      arrivals: theoretical,
      source: 'theoretical_fallback',
      realtimeError: err.message,
    };
  }
}

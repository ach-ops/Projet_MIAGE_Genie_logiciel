/**
 * Service temps réel — Données des bus STAN Nancy.
 *
 * Télécharge le flux temps réel des bus depuis transport.data.gouv.fr.
 * Il contient, pour chaque bus en circulation, les heures d'arrivée réelles
 * à chaque prochain arrêt.
 *
 * Le flux est mis en cache (30 s par défaut) pour limiter les appels réseau.
 *
 * Deux façons d'estimer l'heure d'arrivée :
 *  1. L'arrêt est directement dans le flux → heure exacte
 *  2. Sinon → on applique le retard du dernier arrêt connu avant le nôtre
 */
import axios from 'axios';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { formatTimestampToLocalTime, longToNumber } from '../utils/time.js';
import {
  getScheduledArrivalForTripAtStop,
  getStopTimesForTrip,
} from './gtfs.service.js';

let cache = null;
let lastFetch = 0;

async function fetchFeed() {
  const now = Date.now();
  if (cache && now - lastFetch < config.realtimeCacheDuration) {
    logger.debug('GTFS-RT : cache valide');
    return cache;
  }

  logger.info('GTFS-RT : fetch du feed');
  const response = await axios.get(config.realtimeUrl, {
    responseType: 'arraybuffer',
    timeout: config.axiosTimeoutMs,
  });

  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(response.data)
  );

  logger.info(`GTFS-RT : ${feed.entity.length} entités chargées`);
  cache = feed;
  lastFetch = now;
  return feed;
}

/**
 * Calcule l'heure d'arrivée estimée d'un bus à un arrêt donné.
 *
 * 1. Si l'arrêt est mentionné dans le flux → heure directe.
 * 2. Sinon → on applique le retard d'un arrêt voisin connu.
 *
 * @returns {{ timestamp: number, source: 'exact' | 'propagated' | 'skip' }}
 */
function resolveArrivalForStop(stopId, tripId, stopTimeUpdate, nowSec, referenceDate) {
  // Cas 1 : l'arrêt est directement dans le flux temps réel
  for (const stu of stopTimeUpdate) {
    if (stu.stopId !== stopId) continue;

    const arrivalTime = stu.arrival?.time ?? stu.departure?.time;
    if (!arrivalTime) continue;

    const ts = longToNumber(arrivalTime);
    if (ts <= nowSec) return { source: 'skip' };
    return { timestamp: ts, source: 'exact' };
  }

  // Cas 2 : l'arrêt n'est pas dans le flux, on utilise le retard d'un arrêt voisin
  // On vérifie d'abord que ce trajet dessert bien notre arrêt.
  const scheduled = getScheduledArrivalForTripAtStop(tripId, stopId, referenceDate);
  if (!scheduled) return { source: 'skip' }; // ce trajet ne passe pas par cet arrêt

  // Horaires statiques du trajet pour connaître l'ordre des arrêts
  const staticStopTimes = getStopTimesForTrip(tripId);
  const ourSequence = scheduled.sequence;

  // Retards connus par numéro d'ordre dans le trajet
  const delayBySequence = new Map(); // numéro d'arrêt → retard en secondes
  for (const stu of stopTimeUpdate) {
    const staticSt = staticStopTimes.find(s => s.stop_id?.trim() === stu.stopId);
    if (!staticSt) continue;

    const seq = Number(staticSt.stop_sequence);
    const delay = stu.arrival?.delay ?? stu.departure?.delay ?? null;

    if (delay !== null) {
      delayBySequence.set(seq, longToNumber(delay));
    } else if (stu.arrival?.time || stu.departure?.time) {
      // Calcul du retard : heure réelle - heure théorique
      const rtTs = longToNumber(stu.arrival?.time ?? stu.departure?.time);
      const theoScheduled = getScheduledArrivalForTripAtStop(tripId, stu.stopId, referenceDate);
      if (theoScheduled) {
        delayBySequence.set(seq, Math.round((rtTs * 1000 - theoScheduled.timestamp) / 1000));
      }
    }
  }

  if (delayBySequence.size === 0) return { source: 'skip' }; // aucun retard disponible

  // Dernier arrêt avant le nôtre avec un retard connu
  let lastKnownDelay = null;
  for (const [seq, delay] of delayBySequence) {
    if (seq < ourSequence) {
      if (lastKnownDelay === null || seq > lastKnownDelay.seq) {
        lastKnownDelay = { seq, delay };
      }
    }
  }

  // Si aucun arrêt avant, on prend le premier après
  if (lastKnownDelay === null) {
    for (const [seq, delay] of delayBySequence) {
      if (lastKnownDelay === null || seq < lastKnownDelay.seq) {
        lastKnownDelay = { seq, delay };
      }
    }
  }

  if (lastKnownDelay === null) return { source: 'skip' };

  const estimatedTs = Math.round(scheduled.timestamp / 1000) + lastKnownDelay.delay;
  if (estimatedTs <= nowSec) return { source: 'skip' };

  return { timestamp: estimatedTs, source: 'propagated' };
}

/**
 * Retourne les prochains passages temps réel pour un arrêt et une ligne.
 * Utilise le retard d'un arrêt voisin quand notre arrêt n'est pas dans le flux.
 */
export async function getRealtimeArrivals(stopId, routeId, directionId) {
  const feed = await fetchFeed();
  const nowSec = Math.floor(Date.now() / 1000);
  // Créée une seule fois et partagée entre toutes les itérations pour éviter les recréations
  const referenceDate = new Date();
  const results = [];
  const debug = { routeMatch: 0, dirSkip: 0, exact: 0, propagated: 0, skip: 0 };

  for (const entity of feed.entity) {
    if (!entity.tripUpdate) continue;

    const { trip, stopTimeUpdate } = entity.tripUpdate;
    if (!stopTimeUpdate?.length) continue;
    if (trip.routeId !== routeId) continue;
    debug.routeMatch++;

    // directionId peut être absent du flux → on filtre seulement s'il est présent
    const feedDir = trip.directionId;
    if (feedDir !== null && feedDir !== undefined && Number(feedDir) !== Number(directionId)) {
      debug.dirSkip++;
      continue;
    }

    const resolved = resolveArrivalForStop(stopId, trip.tripId, stopTimeUpdate, nowSec, referenceDate);

    if (resolved.source === 'skip') { debug.skip++; continue; }
    debug[resolved.source]++;

    results.push({
      stopId,
      routeId,
      tripId: trip.tripId,
      directionId: feedDir ?? directionId,
      arrivalTimestamp: resolved.timestamp,
      arrivalLocalTime: formatTimestampToLocalTime(resolved.timestamp * 1000, { timeZone: config.timeZone }),
      arrivalInMin: Math.ceil((resolved.timestamp - nowSec) / 60),
      source: resolved.source === 'exact' ? 'realtime' : 'realtime_estimated',
    });
  }

  logger.debug('GTFS-RT getRealtimeArrivals', { stopId, routeId, directionId, ...debug, total: results.length });

  results.sort((a, b) => a.arrivalTimestamp - b.arrivalTimestamp);
  return results.slice(0, config.maxArrivals);
}

// ─── Fonctions de diagnostic ──────────────────────────────────────────────────

export async function getRawFeedForStop(stopId) {
  const feed = await fetchFeed();
  const matches = [];

  for (const entity of feed.entity) {
    if (!entity.tripUpdate) continue;
    const { trip, stopTimeUpdate } = entity.tripUpdate;
    if (!stopTimeUpdate?.length) continue;

    for (const stu of stopTimeUpdate) {
      if (stu.stopId !== stopId) continue;
      matches.push({
        entityId: entity.id,
        tripId: trip.tripId,
        routeId: trip.routeId,
        directionId: trip.directionId,
        stopId: stu.stopId,
        arrival: stu.arrival ? { time: longToNumber(stu.arrival.time), delay: stu.arrival.delay } : null,
        departure: stu.departure ? { time: longToNumber(stu.departure.time), delay: stu.departure.delay } : null,
      });
    }
  }

  return {
    feedTimestamp: longToNumber(feed.header?.timestamp),
    totalEntities: feed.entity.length,
    matchesForStop: matches,
  };
}

/**
 * Diagnostic : pour un arrêt donné, indique combien de trajets le desservent
 */
export async function diagnoseStopCoverage(stopId, routeId) {
  const feed = await fetchFeed();
  const referenceDate = new Date();
  const report = [];

  for (const entity of feed.entity) {
    if (!entity.tripUpdate) continue;
    const { trip, stopTimeUpdate } = entity.tripUpdate;
    if (!stopTimeUpdate?.length) continue;
    if (routeId && trip.routeId !== routeId) continue;

    const scheduled = getScheduledArrivalForTripAtStop(trip.tripId, stopId, referenceDate);
    const explicitInFeed = stopTimeUpdate.some(s => s.stopId === stopId);
    const stopsInFeed = stopTimeUpdate.map(s => s.stopId);

    report.push({
      tripId: trip.tripId,
      routeId: trip.routeId,
      directionId: trip.directionId,
      scheduledAtStop: scheduled ? {
        arrivalTime: scheduled.arrivalTime,
        inFuture: scheduled.timestamp > Date.now(),
        inMin: Math.ceil((scheduled.timestamp - Date.now()) / 60000),
      } : null,
      explicitInFeed,
      stopTimeUpdateCount: stopTimeUpdate.length,
      stopsInFeed,
    });
  }

  const withScheduled = report.filter(r => r.scheduledAtStop !== null);
  const explicit = withScheduled.filter(r => r.explicitInFeed);
  const partial = withScheduled.filter(r => !r.explicitInFeed);

  return {
    stopId,
    routeId: routeId || 'all',
    totalTripsInFeed: report.length,
    tripsServingStop: withScheduled.length,
    explicitInFeed: explicit.length,
    partialFeed_propagationNeeded: partial.length,
    details: report,
  };
}

/** Réinitialise le cache temps réel, methode pour les tests uniquement. */
export function resetCacheForTesting() {
  cache = null;
  lastFetch = 0;
}

export async function getFeedRouteIds() {
  const feed = await fetchFeed();
  const ids = new Set();
  for (const entity of feed.entity) {
    if (entity.tripUpdate?.trip?.routeId) ids.add(entity.tripUpdate.trip.routeId);
  }
  return Array.from(ids).sort();
}

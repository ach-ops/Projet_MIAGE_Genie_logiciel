/**
 * Service GTFS statique — Données horaires du réseau STAN Nancy.
 *
 * Au démarrage, loadGTFS() lit les fichiers CSV du dossier data/gtfs/ et les charge
 * en mémoire :
 *  - stops.txt          → arrêts (nom, coordonnées GPS)
 *  - routes.txt         → lignes de bus (numéro, couleur)
 *  - trips.txt          → trajets (un trajet = une ligne + direction + heure précise)
 *  - stop_times.txt     → passages de chaque trajet à chaque arrêt
 *  - calendar.txt       → jours de service actifs par identifiant
 *  - calendar_dates.txt → exceptions au calendrier (jours fériés, services spéciaux)
 *  - transfers.txt      → correspondances entre arrêts
 *  - shapes.txt         → tracés des lignes pour la carte
 *
 * Les fonctions exportées permettent de :
 *  - lister les arrêts, lignes, directions
 *  - calculer les prochains passages théoriques
 *  - obtenir le tracé d'une ligne, la liste des arrêts dans l'ordre
 *  - retrouver les terminus pour le calcul des retards
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import csv from 'csv-parser';
import { config } from '../config/index.js';
import { removeBOM } from '../utils/stream.js';
import {
  formatDateYYYYMMDD,
  formatTimestampToLocalTime,
  getWeekdayColumn,
  gtfsTimeToTimestamp,
} from '../utils/time.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GTFS_DIR = path.join(__dirname, '../data/gtfs');

// ─── Données en mémoire ────────────────────────────────────────────────────────

const stops = new Map();          // stop_id → arrêt
const routes = new Map();         // route_id → ligne
const trips = new Map();          // trip_id → trajet
const calendar = new Map();       // service_id → jours actifs
const calendarDates = new Map();  // service_id → exceptions de calendrier
const shapes = new Map();         // shape_id → points du tracé

// Passages indexés par arrêt pour un accès rapide
const stopTimesByStop = new Map();

// Passages indexés par trajet, triés par ordre d'arrêt
const stopTimesByTrip = new Map();

// Correspondances entre arrêts
const transfersByStop = new Map();

// Trajets indexés par ligne
const tripsByRoute = new Map();

// ─── Lecture CSV ──────────────────────────────────────────────────────────────

function readCSV(filename, onRow, dir = GTFS_DIR) {
  return new Promise((resolve, reject) => {
    const file = path.join(dir, filename);
    if (!fs.existsSync(file)) {
      logger.warn(`GTFS : fichier manquant ${filename}`);
      return resolve(0);
    }

    let count = 0;
    fs.createReadStream(file)
      .pipe(removeBOM())
      .pipe(csv())
      .on('data', (row) => { onRow(row); count++; })
      .on('end', () => { logger.info(`GTFS : ${filename} chargé (${count} lignes)`); resolve(count); })
      .on('error', reject);
  });
}

// ─── Chargement GTFS ──────────────────────────────────────────────────────────

export async function loadGTFS(dir = GTFS_DIR) {
  logger.info('GTFS : début du chargement...');

  await readCSV('stops.txt', (row) => {
    if (row.stop_id) stops.set(row.stop_id.trim(), row);
  }, dir);

  await readCSV('routes.txt', (row) => {
    if (row.route_id) routes.set(row.route_id.trim(), row);
  }, dir);

  await readCSV('trips.txt', (row) => {
    if (!row.trip_id) return;
    trips.set(row.trip_id.trim(), row);

    // Index par ligne pour un accès direct sans parcourir tous les trajets
    const rid = row.route_id?.trim();
    if (rid) {
      if (!tripsByRoute.has(rid)) tripsByRoute.set(rid, []);
      tripsByRoute.get(rid).push(row);
    }
  }, dir);

  await readCSV('stop_times.txt', (row) => {
    const stopId = row.stop_id?.trim();
    const tripId = row.trip_id?.trim();
    if (!stopId || !tripId) return;

    if (!stopTimesByStop.has(stopId)) stopTimesByStop.set(stopId, []);
    stopTimesByStop.get(stopId).push(row);

    if (!stopTimesByTrip.has(tripId)) stopTimesByTrip.set(tripId, []);
    stopTimesByTrip.get(tripId).push(row);
  }, dir);

  for (const [, sts] of stopTimesByTrip) {
    sts.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
  }

  await readCSV('calendar.txt', (row) => {
    if (row.service_id) calendar.set(row.service_id.trim(), row);
  }, dir);

  await readCSV('calendar_dates.txt', (row) => {
    const sid = row.service_id?.trim();
    if (!sid) return;
    if (!calendarDates.has(sid)) calendarDates.set(sid, []);
    calendarDates.get(sid).push(row);
  }, dir);

  await readCSV('transfers.txt', (row) => {
    const from = row.from_stop_id?.trim();
    const to   = row.to_stop_id?.trim();
    if (!from || !to || from === to) return;
    if (!transfersByStop.has(from)) transfersByStop.set(from, new Set());
    transfersByStop.get(from).add(to);
    // Correspondance dans les deux sens
    if (!transfersByStop.has(to)) transfersByStop.set(to, new Set());
    transfersByStop.get(to).add(from);
  }, dir);

  await readCSV('shapes.txt', (row) => {
    const shapeId = row.shape_id?.trim();
    if (!shapeId) return;
    if (!shapes.has(shapeId)) shapes.set(shapeId, []);
    shapes.get(shapeId).push({
      lat: parseFloat(row.shape_pt_lat),
      lon: parseFloat(row.shape_pt_lon),
      seq: parseInt(row.shape_pt_sequence, 10),
    });
  }, dir);

  for (const [, pts] of shapes) {
    pts.sort((a, b) => a.seq - b.seq);
  }

  logger.info(`GTFS chargé : ${stops.size} arrêts, ${routes.size} lignes, ${trips.size} trajets, ${stopTimesByStop.size} arrêts avec passages`);
}

// ─── Calendrier ───────────────────────────────────────────────────────────────

// Cache pour éviter de recalculer les services actifs à chaque appel.
// Se remet à jour automatiquement chaque jour.
let _activeCache = null;
let _activeCacheDate = '';

/**
 * Retourne les services actifs pour une date donnée.
 * Prend en compte le calendrier standard et les exceptions.
 *
 */
export function getActiveServiceIds(date = new Date()) {
  const todayStr = formatDateYYYYMMDD(date, config.timeZone);
  if (_activeCache && _activeCacheDate === todayStr) return _activeCache;
  const weekdayCol = getWeekdayColumn(date, config.timeZone);
  const active = new Set();

  for (const [serviceId, row] of calendar) {
    if (row.start_date <= todayStr && row.end_date >= todayStr && row[weekdayCol] === '1') {
      active.add(serviceId);
    }
  }

  for (const [serviceId, exceptions] of calendarDates) {
    for (const ex of exceptions) {
      if (ex.date === todayStr) {
        if (ex.exception_type === '1') active.add(serviceId);
        else if (ex.exception_type === '2') active.delete(serviceId);
      }
    }
  }

  logger.debug(`Calendrier : ${active.size} services actifs pour ${todayStr} (${weekdayCol})`);
  _activeCache     = active;
  _activeCacheDate = todayStr;
  return active;
}

// ─── Horaires théoriques ──────────────────────────────────────────────────────

/**
 * Retourne les prochains passages théoriques pour un arrêt, une ligne et une direction.
 *
 * - Les heures peuvent dépasser minuit (ex: 25:30 = 01h30 le lendemain).
 * - Les passages déjà passés et les services inactifs sont exclus.
 */
export function getTheoreticalArrivals(stopId, routeId, directionId, date = new Date()) {
  const now = date.getTime();
  const activeServices = getActiveServiceIds(date);
  const stopTimes = stopTimesByStop.get(stopId) || [];
  const results = [];
  const debugFiltered = { noTrip: 0, wrongRoute: 0, wrongDir: 0, inactiveService: 0, badTime: 0, past: 0 };

  for (const st of stopTimes) {
    const trip = trips.get(st.trip_id?.trim());
    if (!trip) { debugFiltered.noTrip++; continue; }
    if (trip.route_id !== routeId) { debugFiltered.wrongRoute++; continue; }
    if (String(trip.direction_id) !== String(directionId)) { debugFiltered.wrongDir++; continue; }
    if (!activeServices.has(trip.service_id)) { debugFiltered.inactiveService++; continue; }

    const ts = gtfsTimeToTimestamp(st.arrival_time || st.departure_time, date, config.timeZone);
    if (ts === null) { debugFiltered.badTime++; continue; }
    if (ts < now) { debugFiltered.past++; continue; }

    results.push({
      stopId,
      routeId,
      tripId: trip.trip_id,
      directionId,
      arrivalTime: st.arrival_time,
      arrivalLocalTime: formatTimestampToLocalTime(ts, { timeZone: config.timeZone }),
      arrivalInMin: Math.ceil((ts - now) / 60000),
      source: 'theoretical',
    });
  }

  logger.debug('getTheoreticalArrivals', { stopId, routeId, directionId, found: results.length, filtered: debugFiltered });

  results.sort((a, b) => a.arrivalInMin - b.arrivalInMin);
  return results.slice(0, config.maxArrivals);
}

/**
 * Retourne true si au moins un départ à venir existe pour cette ligne/direction depuis cet arrêt.
 * Utilisé pour filtrer les lignes qui ne circulent plus à l'heure actuelle.
 */
export function hasUpcomingDeparture(stopId, routeId, directionId, date = new Date()) {
  const now = date.getTime();
  const activeServices = getActiveServiceIds(date);
  const stopTimes = stopTimesByStop.get(stopId) || [];

  for (const st of stopTimes) {
    const trip = trips.get(st.trip_id?.trim());
    if (!trip) continue;
    if (trip.route_id !== routeId) continue;
    if (String(trip.direction_id) !== String(directionId)) continue;
    if (!activeServices.has(trip.service_id)) continue;

    const ts = gtfsTimeToTimestamp(st.departure_time || st.arrival_time, date, config.timeZone);
    if (ts === null) continue;
    if (ts < now) continue;

    return true;
  }
  return false;
}

// ─── Accesseurs simples ───────────────────────────────────────────────────────

export function getAllStops() {
  return Array.from(stops.values());
}

export function getAllRoutes() {
  return Array.from(routes.values());
}

export function getStopById(stopId) {
  return stops.get(stopId) || null;
}

export function getStopName(stopId) {
  return stops.get(stopId)?.stop_name || null;
}

export function getRouteInfo(routeId) {
  const route = routes.get(routeId?.trim());
  if (!route) return null;
  return {
    routeId: route.route_id,
    routeName: route.route_short_name || route.route_long_name,
    color: route.route_color ? `#${route.route_color}` : '#666666',
    textColor: route.route_text_color ? `#${route.route_text_color}` : '#ffffff',
  };
}

export function getRoutesByStop(stopId) {
  const stopTimes = stopTimesByStop.get(stopId?.trim()) || [];
  const activeServices = getActiveServiceIds();
  const activeRouteSet = new Set();
  const allRouteSet = new Set();

  for (const st of stopTimes) {
    const trip = trips.get(st.trip_id?.trim());
    if (!trip) continue;
    const rid = trip.route_id?.trim();
    if (!rid) continue;
    allRouteSet.add(rid);
    if (activeServices.has(trip.service_id?.trim())) activeRouteSet.add(rid);
  }

  const routeSet = activeRouteSet.size > 0 ? activeRouteSet : allRouteSet;
  return Array.from(routeSet)
    .map((id) => routes.get(id))
    .filter(Boolean);
}

export function getDirections(stopId, routeId) {
  const stopTimes = stopTimesByStop.get(stopId?.trim()) || [];
  const activeServices = getActiveServiceIds();
  const dirs = new Map();
  const fallbackDirs = new Map();

  for (const st of stopTimes) {
    const trip = trips.get(st.trip_id?.trim());
    if (!trip) continue;
    if (trip.route_id !== routeId) continue;
    fallbackDirs.set(trip.direction_id, trip.trip_headsign);
    if (!activeServices.has(trip.service_id)) continue;
    dirs.set(trip.direction_id, trip.trip_headsign);
  }

  const result = dirs.size > 0 ? dirs : fallbackDirs;
  return Array.from(result.entries()).map(([id, label]) => ({ directionId: id, label }));
}

export function getDirectionsForRoute(routeId) {
  const activeServices = getActiveServiceIds();
  const dirs = new Map();
  const fallbackDirs = new Map();

  for (const trip of (tripsByRoute.get(routeId?.trim()) || [])) {
    fallbackDirs.set(trip.direction_id, trip.trip_headsign);
    if (!activeServices.has(trip.service_id?.trim())) continue;
    dirs.set(trip.direction_id, trip.trip_headsign);
  }

  // Si aucun service actif aujourd'hui, on retourne toutes les directions disponibles
  const result = dirs.size > 0 ? dirs : fallbackDirs;
  return Array.from(result.entries()).map(([id, label]) => ({ directionId: id, label }));
}

export function getDirectionName(stopId, routeId, directionId) {
  const stopTimes = stopTimesByStop.get(stopId) || [];
  for (const st of stopTimes) {
    const trip = trips.get(st.trip_id?.trim());
    if (!trip) continue;
    if (trip.route_id !== routeId) continue;
    if (String(trip.direction_id) === String(directionId)) return trip.trip_headsign;
  }
  return null;
}

export function getRouteShape(routeId, directionId) {
  for (const trip of (tripsByRoute.get(routeId?.trim()) || [])) {
    if (String(trip.direction_id) !== String(directionId)) continue;
    if (!trip.shape_id) continue;
    const pts = shapes.get(trip.shape_id);
    if (pts?.length > 0) return pts.map((p) => [p.lat, p.lon]);
  }
  return [];
}

export function getRouteStops(routeId, directionId) {
  // On prend le trajet avec le plus d'arrêts parmi les services actifs pour avoir le parcours complet
  const activeServices = getActiveServiceIds();
  let bestTripId   = null;
  let bestStopCount = -1;
  let fallbackTripId = null;
  let fallbackCount  = -1;

  for (const trip of (tripsByRoute.get(routeId?.trim()) || [])) {
    const tripId = trip.trip_id?.trim();
    if (String(trip.direction_id) !== String(directionId)) continue;

    const count = (stopTimesByTrip.get(tripId) || []).length;

    if (activeServices.has(trip.service_id?.trim())) {
      if (count > bestStopCount) { bestStopCount = count; bestTripId = tripId; }
    } else if (count > fallbackCount) {
      fallbackCount = count;
      fallbackTripId = tripId;
    }
  }

  const referenceTripId = bestTripId ?? fallbackTripId;
  if (!referenceTripId) return [];

  const sts = stopTimesByTrip.get(referenceTripId) || [];

  return sts
    .map((st) => {
      const sid  = st.stop_id?.trim();
      const stop = stops.get(sid);
      if (!stop) return null;
      return {
        stopId:   sid,
        stopName: stop.stop_name,
        lat:      Number(stop.stop_lat),
        lon:      Number(stop.stop_lon),
        sequence: Number(st.stop_sequence) || 0,
      };
    })
    .filter(Boolean);
}

/**
 * Retourne l'heure d'arrivée théorique d'un trajet à un arrêt donné.
 * Utilisé pour estimer les retards dans le service temps réel.
 *
 */
export function getScheduledArrivalForTripAtStop(tripId, stopId, referenceDate = new Date()) {
  const sts = stopTimesByTrip.get(tripId);
  if (!sts) return null;

  for (const st of sts) {
    if (st.stop_id?.trim() !== stopId) continue;
    const ts = gtfsTimeToTimestamp(st.arrival_time || st.departure_time, referenceDate, config.timeZone);
    if (ts === null) return null;
    return {
      arrivalTime: st.arrival_time || st.departure_time,
      timestamp: ts,
      sequence: Number(st.stop_sequence) || 0,
    };
  }
  return null;
}

/**
 * Retourne tous les passages d'un trajet, triés par ordre d'arrêt.
 */
export function getStopTimesForTrip(tripId) {
  return stopTimesByTrip.get(tripId) || [];
}

export function getAllTerminals() {
  const terminals = [];
  const seen = new Set();

  for (const [, trip] of trips) {
    const key = `${trip.route_id}-${trip.direction_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const sts = stopTimesByTrip.get(trip.trip_id?.trim());
    if (!sts?.length) continue;

    const lastSt = sts[sts.length - 1]; // déjà trié par ordre : le dernier est le terminus

    terminals.push({
      stopId: lastSt.stop_id,
      routeId: trip.route_id,
      directionId: trip.direction_id,
      name: getStopName(lastSt.stop_id),
    });
  }

  return terminals;
}

// ─── Debug ────────────────────────────────────────────────────────────────────

/**
 * Retourne des informations détaillées sur un arrêt pour aider au diagnostic.
 */
export function debugStop(stopId) {
  const stop = stops.get(stopId);
  if (!stop) return { exists: false, stopId };

  const stopTimes = stopTimesByStop.get(stopId) || [];
  const activeServices = getActiveServiceIds();
  const now = new Date();
  const todayStr = formatDateYYYYMMDD(now, config.timeZone);

  const routeMap = new Map();

  for (const st of stopTimes) {
    const trip = trips.get(st.trip_id?.trim());
    if (!trip) continue;

    const rk = `${trip.route_id}|${trip.direction_id}`;
    if (!routeMap.has(rk)) {
      routeMap.set(rk, {
        routeId: trip.route_id,
        directionId: trip.direction_id,
        headsign: trip.trip_headsign,
        serviceActive: activeServices.has(trip.service_id),
        passageCount: 0,
        nextPassage: null,
      });
    }
    const entry = routeMap.get(rk);
    entry.passageCount++;

    const ts = gtfsTimeToTimestamp(st.arrival_time, now, config.timeZone);
    if (ts !== null && ts > now.getTime()) {
      if (!entry.nextPassage || ts < entry.nextPassage) entry.nextPassage = ts;
    }
  }

  return {
    exists: true,
    stopId,
    stopName: stop.stop_name,
    totalStopTimes: stopTimes.length,
    today: todayStr,
    activeServiceCount: activeServices.size,
    routes: Array.from(routeMap.values()).map((r) => ({
      ...r,
      nextPassageInMin: r.nextPassage
        ? Math.ceil((r.nextPassage - now.getTime()) / 60000)
        : null,
    })),
  };
}

/** Retourne les arrêts en correspondance avec l'arrêt donné. */
export function getTransferStops(stopId) {
  return transfersByStop.get(stopId?.trim()) ?? new Set();
}

export function resetGTFSForTesting() {
  stops.clear();
  routes.clear();
  trips.clear();
  calendar.clear();
  calendarDates.clear();
  shapes.clear();
  stopTimesByStop.clear();
  stopTimesByTrip.clear();
  transfersByStop.clear();
  tripsByRoute.clear();
}

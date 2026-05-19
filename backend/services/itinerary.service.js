/**
 * Service de calcul d'itinéraire multimodal.
 *
 * 1. Géocodage des deux adresses grace a l'API adresse.data.gouv.fr
 * 2. Calcul de la distance à pied directe
 * 3. Recherche des arrêts les plus proches de chaque point
 * 4. Pour chaque paire (arrêt départ, arrêt arrivée), vérification qu'une ligne GTFS
 *    les relie dans le bon ordre sur une même direction
 * 5. Construction de segments (marche → bus → marche) avec estimations de durée
 */
import axios from 'axios';
import { config } from '../config/index.js';
import {
  getAllStops,
  getRoutesByStop,
  getDirectionsForRoute,
  getRouteStops,
  getRouteInfo,
  getTransferStops,
  hasUpcomingDeparture,
} from './gtfs.service.js';
import { logger } from '../utils/logger.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

const WALKING_SPEED_KMH    = 5;     // vitesse piétonne moyenne
const WALK_FACTOR          = 1.3;   // correction Haversine → vraie distance
const MAX_WALK_KM          = 1.5;   // rayon de recherche d'arrêts autour du départ/arrivée en km
const MAX_NEAR_STOPS       = 20;    // nombre max d'arrêts candidats par extrémité
const MAX_OPTIONS          = 5;     // nombre max d'itinéraires bus retournés
const BUS_TIME_PER_STOP    = 2;     // estimation : 2 min entre deux arrêts consécutifs
const SAME_LOCATION_KM     = 0.05;  // seuil en-dessous duquel départ ≈ arrivée (50 m)
const MAX_TRANSFER_WALK_KM = 0.35;  // max 350 m à pied pour une correspondance
const ADRESSE_API          = 'https://api-adresse.data.gouv.fr/search/';

/**
 * Distance entre deux points GPS, en kilomètres.
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Durée de marche estimée pour une distance en km, en minutes entières.
 */
export function walkingTimeMin(distanceKm) {
  return Math.ceil((distanceKm / WALKING_SPEED_KMH) * 60);
}

// ─── Géocodage api-adresse.data.gouv.fr ──────────────────────────────────────

/**
 * Convertit une adresse textuelle en coordonnées GPS.
 * Utilise l'API adresse du gouvernement français.
 *
 * @throws {Error} si l'adresse n'est pas trouvée
 */
export async function geocodeAddress(address) {
  const q = address.toLowerCase().includes('nancy')
    ? address
    : `${address} Nancy`;

  logger.debug('Géocodage adresse.data.gouv.fr', { q });

  const res = await axios.get(ADRESSE_API, {
    params: { q, limit: 1 },
    timeout: config.axiosTimeoutMs,
  });

  const features = res.data.features || [];
  if (!features.length) {
    throw Object.assign(new Error(`Adresse introuvable : "${address}"`), { status: 404 });
  }

  const f = features[0];
  return {
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    displayName: f.properties.label,
  };
}

/**
 * Retourne des suggestions d'adresses pour l'autocomplétion.
 */
export async function suggestAddresses(query) {
  if (!query || query.length < 3) return [];

  const q = query.toLowerCase().includes('nancy')
    ? query
    : `${query} nancy`;

  const res = await axios.get(ADRESSE_API, {
    params: { q, limit: 6 },
    timeout: config.axiosTimeoutMs,
  });

  return (res.data.features || []).map(f => ({
    label:       f.properties.label,
    displayName: f.properties.label,
    lat:         f.geometry.coordinates[1],
    lon:         f.geometry.coordinates[0],
  }));
}

// ─── Recherche d'arrêts proches ───────────────────────────────────────────────

/**
 * Retourne les arrêts GTFS les plus proches d'un point GPS,
 * dans un rayon de MAX_WALK_KM km, triés par distance croissante.
 */
export function findNearestStops(lat, lon, maxCount = MAX_NEAR_STOPS) {
  const stops = getAllStops().filter(s => s.location_type !== '1');

  return stops
    .map(s => {
      const sLat = parseFloat(s.stop_lat);
      const sLon = parseFloat(s.stop_lon);
      if (isNaN(sLat) || isNaN(sLon)) return null;
      return {
        stopId:     s.stop_id?.trim(),
        stopName:   s.stop_name,
        lat:        sLat,
        lon:        sLon,
        distanceKm: haversineKm(lat, lon, sLat, sLon),
      };
    })
    .filter(s => s !== null && s.distanceKm <= MAX_WALK_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, maxCount);
}

// ─── Helpers de construction de segments ──────────────────────────────────────

function makeWalkLeg(from, to, rawDistKm, durationMin) {
  return {
    type: 'walk',
    from,
    to,
    distanceKm:  Math.round(rawDistKm * WALK_FACTOR * 100) / 100,
    durationMin,
  };
}

function makeBusLeg(routeId, shortName, routeInfo, direction, fromStop, toStop, stopCount) {
  return {
    type: 'bus',
    route: {
      routeId,
      routeShortName: shortName,
      color:          routeInfo?.color ?? '#004650',
      direction:      direction.label,
    },
    from:       { stopId: fromStop.stopId, stopName: fromStop.stopName },
    to:         { stopId: toStop.stopId,   stopName: toStop.stopName   },
    stopCount,
    durationMin: stopCount * BUS_TIME_PER_STOP,
  };
}

// ─── Algorithme de routage multimodal (0, 1 et 2 correspondances) ─────────────
//
// Stratégie en deux phases :
//   Phase A – Pré-calcul côté destination :
//     Pour chaque arrêt du réseau, on calcule le meilleur moyen de monter dans
//     un bus qui amène à destination (1 trajet bus + marche finale).
//     Résultat : destBoardable Map<stopId → [entrées]>
//
//   Phase B – Exploration depuis l'origine :
//     0 correspondance : fromStop → bus direct → toStop
//     1 correspondance : fromStop → bus1 → arrêt intermédiaire
//                         → (marche ≤ 350 m) → bus2 
//     2 correspondances: fromStop → bus1 → arrêt1
//                         → (marche) → bus2 → arrêt2
//                         → (marche) → bus3 
//
//   Déduplication : on ne garde que le meilleur itinéraire par combinaison
//   de lignes (shortName + directionId), pour avoir des propositions differenciées.

export function findTransitOptions(fromLat, fromLon, toLat, toLon) {
  const fromStops = findNearestStops(fromLat, fromLon);
  const toStops   = findNearestStops(toLat, toLon);
  if (!fromStops.length || !toStops.length) return [];

  // Index rapide stopId → données brutes.
  const allStops = getAllStops().filter(s => s.location_type !== '1');
  const stopById = new Map(allStops.map(s => [s.stop_id?.trim(), s]));

  const _routeStopsCache = new Map();
  const cachedRouteStops = (routeId, directionId) => {
    const key = `${routeId}:${directionId}`;
    if (!_routeStopsCache.has(key)) {
      _routeStopsCache.set(key, getRouteStops(routeId, directionId));
    }
    return _routeStopsCache.get(key);
  };

  // Index Map stopId→index par ligne/direction pour éviter les findIndex
  const _routeStopIndexCache = new Map();
  const cachedRouteStopIndex = (routeId, directionId) => {
    const key = `${routeId}:${directionId}`;
    if (!_routeStopIndexCache.has(key)) {
      const stops = cachedRouteStops(routeId, directionId);
      _routeStopIndexCache.set(key, new Map(stops.map((s, i) => [s.stopId, i])));
    }
    return _routeStopIndexCache.get(key);
  };

  // getRoutesByStop — itère les stop_times à chaque appel sinon
  const _routesByStopCache = new Map();
  const cachedRoutesByStop = (stopId) => {
    if (!_routesByStopCache.has(stopId)) {
      _routesByStopCache.set(stopId, getRoutesByStop(stopId));
    }
    return _routesByStopCache.get(stopId);
  };

  const _departureCache = new Map();
  const cachedHasUpcomingDeparture = (stopId, routeId, directionId) => {
    const key = `${stopId}:${routeId}:${directionId}`;
    if (!_departureCache.has(key)) {
      _departureCache.set(key, hasUpcomingDeparture(stopId, routeId, directionId));
    }
    return _departureCache.get(key);
  };

  // ── Phase A : pré-calcul côté destination ─────────────────────────────────
  //
  // destBoardable : stopId → tableau d'options "monter ici → arriver à dest"
  //   Chaque entrée contient tout ce qu'il faut pour construire le dernier
  //   segment bus + la marche finale.
  //
  const destBoardable = new Map();

  for (const toStop of toStops) {
    const walkFromMin = walkingTimeMin(toStop.distanceKm * WALK_FACTOR);

    for (const route of getRoutesByStop(toStop.stopId)) {
      const routeId   = route.route_id?.trim();
      const routeInfo = getRouteInfo(routeId);
      const shortName = routeInfo?.routeName ?? route.route_short_name?.trim();

      for (const direction of getDirectionsForRoute(routeId)) {
        const stops = cachedRouteStops(routeId, direction.directionId);
        const toIdx = stops.findIndex(s => s.stopId === toStop.stopId);
        if (toIdx === -1) continue;

        for (let i = 0; i < toIdx; i++) {
          const board     = stops[i];
          const stopCount = toIdx - i;
          const entry     = {
            shortName, routeId, routeInfo, direction,
            toStop, stopCount,
            busTimeMin:  stopCount * BUS_TIME_PER_STOP,
            walkFromMin,
            boardStopName: board.stopName,
          };
          if (!destBoardable.has(board.stopId)) destBoardable.set(board.stopId, []);
          destBoardable.get(board.stopId).push(entry);
        }
      }
    }
  }

  // Index des arrêts présents dans destBoardable (pour recherche par proximité)
  const destIndex = [];
  for (const [stopId, entries] of destBoardable) {
    const raw = stopById.get(stopId);
    if (!raw) continue;
    destIndex.push({
      stopId,
      lat:     parseFloat(raw.stop_lat),
      lon:     parseFloat(raw.stop_lon),
      name:    raw.stop_name,
      entries,
    });
  }

  // ── Collecteur d'options ───────────────────────────────────────────────────
  const bestByCombo = new Map();
  let bestDuration = Infinity;
  function addOpt(comboKey, opt) {
    const ex = bestByCombo.get(comboKey);
    if (!ex || opt.totalDurationMin < ex.totalDurationMin) {
      bestByCombo.set(comboKey, opt);
      if (opt.totalDurationMin < bestDuration) bestDuration = opt.totalDurationMin;
    }
  }

  // Index des stops de destBoardable par stopId pour visualisation rapide
  const destIndexById = new Map(destIndex.map(d => [d.stopId, d]));

  // Cherche dans destIndex les arrêts accessibles depuis (lat, lon) :
  // 1. Par proximité géographique (≤ MAX_TRANSFER_WALK_KM)
  // 2. Via les correspondances officielles du GTFS
  function nearbyDest(lat, lon, alightStopId) {
    const byGeo = destIndex.filter(d => haversineKm(lat, lon, d.lat, d.lon) <= MAX_TRANSFER_WALK_KM);

    // Ajouter les correspondances officielles GTFS si elles ne sont pas déjà incluses
    const seen = new Set(byGeo.map(d => d.stopId));
    if (alightStopId) {
      for (const transferStopId of getTransferStops(alightStopId)) {
        if (!seen.has(transferStopId) && destIndexById.has(transferStopId)) {
          byGeo.push(destIndexById.get(transferStopId));
          seen.add(transferStopId);
        }
      }
    }
    return byGeo;
  }

  // ── 0 correspondance ──────────────────────────────────────────────────────
  for (const fromStop of fromStops) {
    const walkToMin = walkingTimeMin(fromStop.distanceKm * WALK_FACTOR);

    for (const route of cachedRoutesByStop(fromStop.stopId)) {
      const routeId   = route.route_id?.trim();
      const routeInfo = getRouteInfo(routeId);
      const shortName = routeInfo?.routeName ?? route.route_short_name?.trim();

      for (const direction of getDirectionsForRoute(routeId)) {
        if (!cachedHasUpcomingDeparture(fromStop.stopId, routeId, direction.directionId)) continue;

        const stopIdx = cachedRouteStopIndex(routeId, direction.directionId);
        const fromIdx = stopIdx.get(fromStop.stopId) ?? -1;
        if (fromIdx === -1) continue;

        for (const toStop of toStops) {
          const toIdx = stopIdx.get(toStop.stopId) ?? -1;
          if (toIdx === -1 || toIdx <= fromIdx) continue;

          const walkFromMin = walkingTimeMin(toStop.distanceKm * WALK_FACTOR);
          const stopCount   = toIdx - fromIdx;
          const busTimeMin  = stopCount * BUS_TIME_PER_STOP;

          addOpt(`${shortName}:${direction.directionId}`, {
            totalDurationMin: walkToMin + busTimeMin + walkFromMin,
            legs: [
              makeWalkLeg(
                { lat: fromLat, lon: fromLon, name: 'Départ' },
                { stopId: fromStop.stopId, stopName: fromStop.stopName, lat: fromStop.lat, lon: fromStop.lon },
                fromStop.distanceKm, walkToMin,
              ),
              makeBusLeg(routeId, shortName, routeInfo, direction, fromStop, toStop, stopCount),
              makeWalkLeg(
                { stopId: toStop.stopId, stopName: toStop.stopName, lat: toStop.lat, lon: toStop.lon },
                { lat: toLat, lon: toLon, name: 'Arrivée' },
                toStop.distanceKm, walkFromMin,
              ),
            ],
          });
        }
      }
    }
  }

  // ── 1 correspondance ──────────────────────────────────────────────────────
  for (const fromStop of fromStops) {
    const walkToMin = walkingTimeMin(fromStop.distanceKm * WALK_FACTOR);

    for (const route1 of cachedRoutesByStop(fromStop.stopId)) {
      const routeId1   = route1.route_id?.trim();
      const routeInfo1 = getRouteInfo(routeId1);
      const shortName1 = routeInfo1?.routeName ?? route1.route_short_name?.trim();

      for (const dir1 of getDirectionsForRoute(routeId1)) {
        if (!cachedHasUpcomingDeparture(fromStop.stopId, routeId1, dir1.directionId)) continue;

        const stops1   = cachedRouteStops(routeId1, dir1.directionId);
        const fromIdx1 = cachedRouteStopIndex(routeId1, dir1.directionId).get(fromStop.stopId) ?? -1;
        if (fromIdx1 === -1) continue;

        for (let ti = fromIdx1 + 1; ti < stops1.length; ti++) {
          const alight1     = stops1[ti];
          const busTime1Min = (ti - fromIdx1) * BUS_TIME_PER_STOP;
          const raw1        = stopById.get(alight1.stopId);
          if (!raw1) continue;
          const alight1Lat  = parseFloat(raw1.stop_lat);
          const alight1Lon  = parseFloat(raw1.stop_lon);

          for (const db of nearbyDest(alight1Lat, alight1Lon, alight1.stopId)) {
            const tDist = haversineKm(alight1Lat, alight1Lon, db.lat, db.lon);
            const tMin  = walkingTimeMin(tDist * WALK_FACTOR);

            for (const d2 of db.entries) {
              if (d2.shortName === shortName1) continue;
              if (!cachedHasUpcomingDeparture(db.stopId, d2.routeId, d2.direction.directionId)) continue;

              const total    = walkToMin + busTime1Min + tMin + d2.busTimeMin + d2.walkFromMin;
              const comboKey = `${shortName1}:${dir1.directionId}→${d2.shortName}:${d2.direction.directionId}`;

              addOpt(comboKey, {
                totalDurationMin: total,
                legs: [
                  makeWalkLeg(
                    { lat: fromLat, lon: fromLon, name: 'Départ' },
                    { stopId: fromStop.stopId, stopName: fromStop.stopName, lat: fromStop.lat, lon: fromStop.lon },
                    fromStop.distanceKm, walkToMin,
                  ),
                  makeBusLeg(routeId1, shortName1, routeInfo1, dir1, fromStop,
                    { stopId: alight1.stopId, stopName: alight1.stopName }, ti - fromIdx1),
                  // Marche de correspondance (seulement si ≠ 0)
                  ...(tMin > 0 ? [makeWalkLeg(
                    { stopId: alight1.stopId, stopName: alight1.stopName, lat: alight1Lat, lon: alight1Lon },
                    { stopId: db.stopId,      stopName: db.name,          lat: db.lat,     lon: db.lon      },
                    tDist, tMin,
                  )] : []),
                  makeBusLeg(d2.routeId, d2.shortName, d2.routeInfo, d2.direction,
                    { stopId: db.stopId, stopName: db.name }, d2.toStop, d2.stopCount),
                  makeWalkLeg(
                    { stopId: d2.toStop.stopId, stopName: d2.toStop.stopName, lat: d2.toStop.lat, lon: d2.toStop.lon },
                    { lat: toLat, lon: toLon, name: 'Arrivée' },
                    d2.toStop.distanceKm, d2.walkFromMin,
                  ),
                ],
              });
            }
          }
        }
      }
    }
  }

  // ── 2 correspondances ─────────────────────────────────────────────────────
  // Seulement si moins de MAX_OPTIONS trouvés avec 0 et 1 correspondance,
  // pour éviter de surcharger les résultats de trajets trop complexes.
  if (bestByCombo.size < MAX_OPTIONS) {

    // Index spatial de TOUS les arrêts du réseau (pour trouver un 2e bus intermédiaire)
    const allStopsIndex = allStops.map(s => ({
      stopId: s.stop_id,
      stopName: s.stop_name,
      lat: parseFloat(s.stop_lat),
      lon: parseFloat(s.stop_lon),
    }));

    for (const fromStop of fromStops) {
      const walkToMin = walkingTimeMin(fromStop.distanceKm * WALK_FACTOR);

      for (const route1 of cachedRoutesByStop(fromStop.stopId)) {
        const routeId1   = route1.route_id?.trim();
        const routeInfo1 = getRouteInfo(routeId1);
        const shortName1 = routeInfo1?.routeName ?? route1.route_short_name?.trim();

        for (const dir1 of getDirectionsForRoute(routeId1)) {
          if (!cachedHasUpcomingDeparture(fromStop.stopId, routeId1, dir1.directionId)) continue;

          const stops1   = cachedRouteStops(routeId1, dir1.directionId);
          const fromIdx1 = cachedRouteStopIndex(routeId1, dir1.directionId).get(fromStop.stopId) ?? -1;
          if (fromIdx1 === -1) continue;

          const limit1 = Math.min(stops1.length, fromIdx1 + 16);
          for (let ti = fromIdx1 + 1; ti < limit1; ti++) {
            const alight1     = stops1[ti];
            const busTime1Min = (ti - fromIdx1) * BUS_TIME_PER_STOP;
            const raw1        = stopById.get(alight1.stopId);
            if (!raw1) continue;
            const alight1Lat  = parseFloat(raw1.stop_lat);
            const alight1Lon  = parseFloat(raw1.stop_lon);

            const nearby2 = allStopsIndex.filter(
              s => haversineKm(alight1Lat, alight1Lon, s.lat, s.lon) <= MAX_TRANSFER_WALK_KM,
            );

            for (const board2Stop of nearby2) {
              const t1Dist = haversineKm(alight1Lat, alight1Lon, board2Stop.lat, board2Stop.lon);
              const t1Min  = walkingTimeMin(t1Dist * WALK_FACTOR);

              for (const route2 of cachedRoutesByStop(board2Stop.stopId)) {
                const routeId2   = route2.route_id?.trim();
                const routeInfo2 = getRouteInfo(routeId2);
                const shortName2 = routeInfo2?.routeName ?? route2.route_short_name?.trim();
                if (shortName2 === shortName1) continue;

                for (const dir2 of getDirectionsForRoute(routeId2)) {
                  if (!cachedHasUpcomingDeparture(board2Stop.stopId, routeId2, dir2.directionId)) continue;

                  const stops2    = cachedRouteStops(routeId2, dir2.directionId);
                  const board2Idx = cachedRouteStopIndex(routeId2, dir2.directionId).get(board2Stop.stopId) ?? -1;
                  if (board2Idx === -1) continue;

                  const limit2 = Math.min(stops2.length, board2Idx + 16);
                  for (let tj = board2Idx + 1; tj < limit2; tj++) {
                    const alight2     = stops2[tj];
                    const busTime2Min = (tj - board2Idx) * BUS_TIME_PER_STOP;
                    const raw2        = stopById.get(alight2.stopId);
                    if (!raw2) continue;
                    const alight2Lat  = parseFloat(raw2.stop_lat);
                    const alight2Lon  = parseFloat(raw2.stop_lon);

                    for (const db of nearbyDest(alight2Lat, alight2Lon, alight2.stopId)) {
                      const t2Dist = haversineKm(alight2Lat, alight2Lon, db.lat, db.lon);
                      const t2Min  = walkingTimeMin(t2Dist * WALK_FACTOR);

                      for (const d3 of db.entries) {
                        if (d3.shortName === shortName1 || d3.shortName === shortName2) continue;
                        if (!cachedHasUpcomingDeparture(db.stopId, d3.routeId, d3.direction.directionId)) continue;

                        const total = walkToMin + busTime1Min + t1Min
                          + busTime2Min + t2Min + d3.busTimeMin + d3.walkFromMin;

                        if (total > bestDuration * 2) continue;

                        const comboKey = `${shortName1}:${dir1.directionId}`
                          + `→${shortName2}:${dir2.directionId}`
                          + `→${d3.shortName}:${d3.direction.directionId}`;

                        addOpt(comboKey, {
                          totalDurationMin: total,
                          legs: [
                            makeWalkLeg(
                              { lat: fromLat, lon: fromLon, name: 'Départ' },
                              { stopId: fromStop.stopId, stopName: fromStop.stopName, lat: fromStop.lat, lon: fromStop.lon },
                              fromStop.distanceKm, walkToMin,
                            ),
                            makeBusLeg(routeId1, shortName1, routeInfo1, dir1, fromStop,
                              { stopId: alight1.stopId, stopName: alight1.stopName }, ti - fromIdx1),
                            ...(t1Min > 0 ? [makeWalkLeg(
                              { stopId: alight1.stopId, stopName: alight1.stopName, lat: alight1Lat, lon: alight1Lon },
                              { stopId: board2Stop.stopId, stopName: board2Stop.stopName, lat: board2Stop.lat, lon: board2Stop.lon },
                              t1Dist, t1Min,
                            )] : []),
                            makeBusLeg(routeId2, shortName2, routeInfo2, dir2, board2Stop,
                              { stopId: alight2.stopId, stopName: alight2.stopName }, tj - board2Idx),
                            ...(t2Min > 0 ? [makeWalkLeg(
                              { stopId: alight2.stopId, stopName: alight2.stopName, lat: alight2Lat, lon: alight2Lon },
                              { stopId: db.stopId,      stopName: db.name,          lat: db.lat,     lon: db.lon      },
                              t2Dist, t2Min,
                            )] : []),
                            makeBusLeg(d3.routeId, d3.shortName, d3.routeInfo, d3.direction,
                              { stopId: db.stopId, stopName: db.name }, d3.toStop, d3.stopCount),
                            makeWalkLeg(
                              { stopId: d3.toStop.stopId, stopName: d3.toStop.stopName, lat: d3.toStop.lat, lon: d3.toStop.lon },
                              { lat: toLat, lon: toLon, name: 'Arrivée' },
                              d3.toStop.distanceKm, d3.walkFromMin,
                            ),
                          ],
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // ── Sélection finale avec diversité de lignes ─────────────────────────────
  //
  // On trie toutes les options par durée, puis on applique une règle de diversité :
  // au maximum MAX_PER_MAIN_LINE options avec la même ligne principale (1er bus).
  const MAX_PER_MAIN_LINE = 2;
  const all = Array.from(bestByCombo.values());
  all.sort((a, b) => a.totalDurationMin - b.totalDurationMin);

  const selected = [];
  const mainLineCount = new Map();

  for (const opt of all) {
    if (selected.length >= MAX_OPTIONS) break;
    // Identifier la ligne principale
    const firstBus = opt.legs.find(l => l.type === 'bus');
    const mainLine = firstBus?.route?.routeShortName ?? '';
    const count = mainLineCount.get(mainLine) ?? 0;
    if (count >= MAX_PER_MAIN_LINE) continue;
    mainLineCount.set(mainLine, count + 1);
    selected.push(opt);
  }

  return selected;
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

/**
 * Calcule un itinéraire complet entre deux adresses.
 *
 * Retourne :
 * - Les coordonnées résolues des deux adresses
 * - L'option "tout à pied" (distance + durée)
 * - Jusqu'à MAX_OPTIONS itinéraires bus avec segments marche+bus+marche
 */
export async function computeItinerary(fromAddress, toAddress) {
  const [from, to] = await Promise.all([
    geocodeAddress(fromAddress),
    geocodeAddress(toAddress),
  ]);

  // Même lieu : coordonnées résolues trop proches (< 50 m)
  const rawKm = haversineKm(from.lat, from.lon, to.lat, to.lon);
  if (rawKm < SAME_LOCATION_KM) {
    throw Object.assign(
      new Error('Le point de départ et d\'arrivée correspondent au même lieu.'),
      { status: 400 },
    );
  }

  logger.info('Itinéraire calculé', {
    from: { address: fromAddress, lat: from.lat, lon: from.lon },
    to:   { address: toAddress,   lat: to.lat,   lon: to.lon   },
  });

  const directKm   = rawKm * WALK_FACTOR;
  const walkingMin = walkingTimeMin(directKm);

  const walkingOnly = {
    type: 'walking',
    distanceKm:  Math.round(directKm * 100) / 100,
    durationMin: walkingMin,
  };

  // ── Seuils de pertinence bus ─────────────────────────────────────────────
  // Le bus est proposé dès 500 m et uniquement s'il est plus
  // rapide que la marche directe.
  const MIN_DIST_FOR_BUS = 0.5;

  let options = [];
  if (rawKm >= MIN_DIST_FOR_BUS) {
    options = findTransitOptions(from.lat, from.lon, to.lat, to.lon)
      .filter(opt => opt.totalDurationMin <= walkingMin);
  }

  return {
    from: { address: fromAddress, displayName: from.displayName, lat: from.lat, lon: from.lon },
    to:   { address: toAddress,   displayName: to.displayName,   lat: to.lat,   lon: to.lon   },
    walkingOnly,
    options,
  };
}

// ─── Diagnostic ───────────────────────────────────────────────────────────────

/**
 * Retourne les détails de ce que l'algorithme voit pour une paire d'adresses :
 * arrêts proches, lignes disponibles, options brutes (avant filtre).
 */
export async function debugItinerary(fromAddress, toAddress) {
  const [from, to] = await Promise.all([
    geocodeAddress(fromAddress),
    geocodeAddress(toAddress),
  ]);

  const rawKm     = haversineKm(from.lat, from.lon, to.lat, to.lon);
  const directKm  = rawKm * WALK_FACTOR;
  const walkingMin = walkingTimeMin(directKm);

  const fromStops = findNearestStops(from.lat, from.lon);
  const toStops   = findNearestStops(to.lat,   to.lon);

  // Pour chaque arrêt proche, lister les lignes qui le desservent avec détails
  function stopsWithRoutes(nearStops) {
    return nearStops.map(s => {
      const routes = getRoutesByStop(s.stopId).map(r => {
        const rid  = r.route_id?.trim();
        const info = getRouteInfo(rid);
        const dirs = getDirectionsForRoute(rid).map(d => {
          const routeStops = getRouteStops(rid, d.directionId);
          const myIdx      = routeStops.findIndex(rs => rs.stopId === s.stopId);
          return {
            directionId: d.directionId,
            label:       d.label,
            totalStops:  routeStops.length,
            myIndexInRoute: myIdx,
          };
        });
        return { routeId: rid, name: info?.routeName ?? r.route_short_name, color: info?.color, directions: dirs };
      });
      return { stopId: s.stopId, stopName: s.stopName, distanceKm: Math.round(s.distanceKm * 1000) / 1000, routes };
    });
  }

  const fromStopsInfo = stopsWithRoutes(fromStops);
  const toStopsInfo   = stopsWithRoutes(toStops);

  const directMatches = [];
  for (const fs of fromStops) {
    for (const r of getRoutesByStop(fs.stopId)) {
      const rid  = r.route_id?.trim();
      const info = getRouteInfo(rid);
      const name = info?.routeName ?? r.route_short_name?.trim();
      for (const dir of getDirectionsForRoute(rid)) {
        const routeStops = getRouteStops(rid, dir.directionId);
        const fromIdx    = routeStops.findIndex(rs => rs.stopId === fs.stopId);
        if (fromIdx === -1) continue;
        for (const ts of toStops) {
          const toIdx = routeStops.findIndex(rs => rs.stopId === ts.stopId);
          if (toIdx > fromIdx) {
            directMatches.push({
              line: name, routeId: rid, directionId: dir.directionId, label: dir.label,
              fromStop: fs.stopId, fromIdx, toStop: ts.stopId, toIdx,
              stopCount: toIdx - fromIdx,
            });
          }
        }
      }
    }
  }

  const rawOptions = findTransitOptions(from.lat, from.lon, to.lat, to.lon);
  const filteredOptions = rawOptions.filter(o => o.totalDurationMin <= walkingMin);

  return {
    from:        { address: fromAddress, ...from },
    to:          { address: toAddress,   ...to   },
    distanceKm:  Math.round(rawKm * 1000) / 1000,
    walkingMin,
    fromStops:   fromStopsInfo,
    toStops:     toStopsInfo,
    directMatches,
    rawOptionsCount:      rawOptions.length,
    filteredOptionsCount: filteredOptions.length,
    rawOptions: rawOptions.map(o => ({
      totalDurationMin: o.totalDurationMin,
      fasterThanWalk: o.totalDurationMin < walkingMin,
      legs: o.legs.map(l => l.type === 'bus'
        ? `BUS ${l.route.routeShortName} (${l.stopCount} arrêts, ${l.durationMin} min)`
        : `MARCHE ${l.distanceKm} km (${l.durationMin} min)`),
    })),
  };
}

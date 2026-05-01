/**
 * Contrôleur Transport.
 * Relie les routes HTTP aux services. Chaque fonction renvoie une réponse JSON.
 */
import {
  getAllStops,
  getAllRoutes,
  getRoutesByStop,
  getDirections,
  getDirectionsForRoute,
  getRouteShape,
  getRouteStops,
} from '../services/gtfs.service.js';
import { getAllArrivals, getArrivalsRealtime } from '../services/arrivals.service.js';
import { getVelibStations } from '../services/velib.service.js';

// ─── Arrêts ───────────────────────────────────────────────────────────────────

export function listStops(_req, res) {
  res.json(getAllStops());
}

export async function listVelibStations(req, res) {
  // ?refresh=1 force le rechargement même si le cache n'est pas expiré
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
  try {
    const stations = await getVelibStations(forceRefresh);
    res.json({ count: stations.length, stations, degraded: false });
    } catch {
    // Si l'API Vélib est hors service, on retourne un tableau vide avec degraded: true
    res.json({ count: 0, stations: [], degraded: true });
  }
}

export function listRoutesByStop(req, res) {
  res.json(getRoutesByStop(req.params.stopId));
}

// ─── Lignes ───────────────────────────────────────────────────────────────────

export function listAllRoutes(_req, res) {
  res.json(getAllRoutes());
}

export function listDirectionsForRoute(req, res) {
  res.json(getDirectionsForRoute(req.params.routeId));
}

export function listShape(req, res) {
  const { routeId, directionId } = req.params;
  res.json({ points: getRouteShape(routeId, directionId) });
}

export function listRouteStops(req, res) {
  const { routeId, directionId } = req.params;
  res.json({ stops: getRouteStops(routeId, directionId) });
}

// ─── Directions ───────────────────────────────────────────────────────────────

export function listDirections(req, res) {
  const { stopId, routeId } = req.params;
  res.json(getDirections(stopId, routeId));
}

// ─── Passages ─────────────────────────────────────────────────────────────────

export async function listArrivals(req, res) {
  const { stopId, routeId, directionId } = req.params;
  res.json(await getArrivalsRealtime(stopId, routeId, directionId));
}

export async function listAllArrivals(req, res) {
  const { stopId, routeId, directionId } = req.params;
  res.json(await getAllArrivals(stopId, routeId, directionId));
}

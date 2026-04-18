import { getAllStops, getRoutesByStop, getDirections, getStopName, getAllRoutes, getDirectionsForRoute } from "./gtfs.service.js";
import { getRealtimeArrivals } from "./realtime.service.js";

async function listAllArrivals(req, res) {
  const { stopId, routeId, directionId } = req.params;
  try {
    const realtime = await getRealtimeArrivals(stopId, routeId, directionId);
    const { getTheoreticalArrivals, getStopName, getDirectionName } = await import("./gtfs.service.js");
    const theoretical = getTheoreticalArrivals(stopId, routeId, directionId);
    const stopName = getStopName(stopId);
    const directionName = getDirectionName(stopId, routeId, directionId);

    res.json({
      stopName,
      directionName,
      realtime,
      theoretical
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des arrivées" });
  }
}

function listStops(req, res) {
  res.json(getAllStops());
}

function listRoutes(req, res) {
  const { stopId } = req.params;
  res.json(getRoutesByStop(stopId));
}

function listDirections(req, res) {
  const { stopId, routeId } = req.params;
  res.json(getDirections(stopId, routeId));
}

async function listArrivals(req, res) {
  const { stopId, routeId, directionId } = req.params;

  try {
    const arrivals = await getRealtimeArrivals(
      stopId,
      routeId,
      directionId
    );

    const directions = getDirections(stopId, routeId);
    const direction = directions.find(d => d.directionId === directionId);
    const directionLabel = direction ? direction.label : null;

    const stopName = getStopName(stopId);

    res.json({
      stopName,
      direction: directionLabel,
      arrivals
    });
  } catch {
    res.status(500).json({ error: "Erreur temps réel" });
  }
}

function listAllRoutes(req, res) {
  res.json(getAllRoutes());
}

function listDirectionsForRoute(req, res) {
  const { routeId } = req.params;
  res.json(getDirectionsForRoute(routeId));
}

export {
  listStops,
  listRoutes,
  listDirections,
  listArrivals,
  listAllArrivals,
  listAllRoutes,
  listDirectionsForRoute
};
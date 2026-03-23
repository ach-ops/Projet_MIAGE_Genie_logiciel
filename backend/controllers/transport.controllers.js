import { Router } from "express";
import {
  listStops,
  listRoutes,
  listDirections,
  listArrivals,
  listAllArrivals,
  listShape,
  listAllRoutes,
  listDirectionsForRoute,
} from "../services/transport.service.js";

const router = Router();

router.get("/stops", listStops);

router.get("/stops/:stopId/routes", listRoutes);

router.get("/stops/:stopId/routes/:routeId/directions", listDirections);

router.get(
  "/stops/:stopId/routes/:routeId/directions/:directionId/arrivals",
  listArrivals
);

router.get("/stops/:stopId/routes/:routeId/directions/:directionId/all-arrivals", listAllArrivals);

router.get("/routes/:routeId/directions/:directionId/shape", listShape);

router.get("/routes", listAllRoutes);

router.get("/routes/:routeId/directions", listDirectionsForRoute);


export default router;
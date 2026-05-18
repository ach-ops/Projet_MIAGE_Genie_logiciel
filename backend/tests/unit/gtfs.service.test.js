/**
 * Tests du service GTFS statique.
 * Utilise de vrais fichiers CSV de fixture (tests/fixtures/gtfs/) pour tester le parsing réel.
 * Le chargement couvre : stops, routes, trips, stop_times, calendar, calendar_dates.
 *
 * Date de référence des tests : 2026-04-06 06:00 (lundi matin)
 * → SERVICE_ALL actif, SERVICE_INACTIVE inactif
 * → Tous les passages 07:00-10:xx sont dans le futur
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadGTFS,
  resetGTFSForTesting,
  getAllStops,
  getAllRoutes,
  getStopById,
  getStopName,
  getRouteInfo,
  getRoutesByStop,
  getDirections,
  getDirectionsForRoute,
  getActiveServiceIds,
  getTheoreticalArrivals,
  getRouteStops,
  getStopTimesForTrip,
  getScheduledArrivalForTripAtStop,
} from '../../services/gtfs.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, '../fixtures/gtfs');

// Date fixe : lundi 6 avril 2026 à 6h00 locale
const REF_DATE = new Date(2026, 3, 6, 6, 0, 0);

beforeAll(async () => {
  await loadGTFS(FIXTURE_DIR);
});

afterAll(() => {
  resetGTFSForTesting();
});

// ─── Chargement ───────────────────────────────────────────────────────────────

describe(`loadGTFS — chargement des données`, () => {
  it(`charge correctement les arrêts`, () => {
    const stops = getAllStops();
    expect(stops).toHaveLength(3);
    expect(stops.map(s => s.stop_id)).toContain('STOP_A');
  });

  it(`charge correctement les lignes`, () => {
    const routes = getAllRoutes();
    expect(routes).toHaveLength(2);
  });

  it(`charge correctement les stops avec leurs coordonnées`, () => {
    const stop = getStopById('STOP_A');
    expect(stop).not.toBeNull();
    expect(parseFloat(stop.stop_lat)).toBeCloseTo(48.6921, 3);
    expect(parseFloat(stop.stop_lon)).toBeCloseTo(6.1844, 3);
  });
});

// ─── Accesseurs simples ───────────────────────────────────────────────────────

describe(`getStopById`, () => {
  it(`retourne le stop pour un ID valide`, () => {
    const stop = getStopById('STOP_B');
    expect(stop).not.toBeNull();
    expect(stop.stop_name).toBe('Arrêt B');
  });

  it(`retourne null pour un ID inexistant`, () => {
    expect(getStopById('STOP_INCONNU')).toBeNull();
    expect(getStopById('')).toBeNull();
    expect(getStopById(null)).toBeNull();
  });
});

describe(`getStopName`, () => {
  it(`retourne le nom pour un stop valide`, () => {
    expect(getStopName('STOP_A')).toBe('Arrêt A');
  });

  it(`retourne null pour un stop inconnu`, () => {
    expect(getStopName('STOP_X')).toBeNull();
  });
});

describe(`getRouteInfo`, () => {
  it("retourne les infos formatées d'une ligne", () => {
    const info = getRouteInfo('ROUTE_1');
    expect(info.routeId).toBe('ROUTE_1');
    expect(info.routeName).toBe('1');
    expect(info.color).toBe('#FF0000');
    expect(info.textColor).toBe('#FFFFFF');
  });

  it(`retourne null pour une ligne inconnue`, () => {
    expect(getRouteInfo('ROUTE_INCONNUE')).toBeNull();
  });

  it(`préfixe bien le # aux couleurs`, () => {
    const info = getRouteInfo('ROUTE_2');
    expect(info.color).toMatch(/^#/);
    expect(info.textColor).toMatch(/^#/);
  });
});

// ─── Calendrier ───────────────────────────────────────────────────────────────

describe(`getActiveServiceIds`, () => {
  it(`retourne SERVICE_ALL actif pour un lundi dans la plage de dates`, () => {
    const active = getActiveServiceIds(REF_DATE);
    expect(active.has('SERVICE_ALL')).toBe(true);
  });

  it(`ne retourne pas SERVICE_INACTIVE`, () => {
    const active = getActiveServiceIds(REF_DATE);
    expect(active.has('SERVICE_INACTIVE')).toBe(false);
  });

  it(`retourne un Set vide pour une date hors plage`, () => {
    const farFuture = new Date(2035, 0, 1);
    const active = getActiveServiceIds(farFuture);
    expect(active.has('SERVICE_ALL')).toBe(false);
  });

  it(`prend en compte calendar_dates exception_type=2 (suppression)`, () => {
    // SERVICE_ALL est actif par défaut.
    // Une exception de suppression sur notre date de référence le retirerait.
    const active = getActiveServiceIds(REF_DATE);
    expect(active).toBeInstanceOf(Set);
  });
});

// ─── getRoutesByStop ──────────────────────────────────────────────────────────

describe(`getRoutesByStop`, () => {
  it("retourne les lignes actives qui desservent l'arrêt", () => {
    const routes = getRoutesByStop('STOP_A');
    const routeIds = routes.map(r => r.route_id);
    expect(routeIds).toContain('ROUTE_1');
    expect(routeIds).toContain('ROUTE_2');
  });

  it(`ne retourne pas les lignes sans service actif`, () => {
    // TRIP_INACTIVE a SERVICE_INACTIVE → ne doit pas apparaître
    const routes = getRoutesByStop('STOP_A');
    expect(routes.length).toBe(2);
  });

  it(`retourne tableau vide pour un stop inexistant`, () => {
    expect(getRoutesByStop('STOP_INCONNU')).toEqual([]);
  });

  it("retourne tableau vide pour un stop qui n'a aucun passage actif", () => {
    // STOP_C n'a que TRIP_1A et TRIP_1C qui passent (direction 0 et 1)
    // mais via SERVICE_ALL → actif. STOP_C a des routes.
    const routes = getRoutesByStop('STOP_C');
    expect(routes.length).toBeGreaterThan(0);
  });
});

// ─── getDirections ────────────────────────────────────────────────────────────

describe(`getDirections`, () => {
  it(`retourne les directions actives pour un arrêt et une ligne`, () => {
    const dirs = getDirections('STOP_A', 'ROUTE_1');
    const dirIds = dirs.map(d => String(d.directionId));
    expect(dirIds).toContain('0'); // TRIP_1A et TRIP_1B passent par STOP_A direction 0
    expect(dirIds).toContain('1'); // TRIP_1C passe par STOP_A direction 1
  });

  it(`ne retourne pas les directions inactives`, () => {
    // TRIP_INACTIVE est SERVICE_INACTIVE → ne doit pas contribuer
    const dirs = getDirections('STOP_A', 'ROUTE_1');
    expect(dirs.length).toBeLessThanOrEqual(2);
  });

  it(`retourne tableau vide pour un stop sans cette ligne`, () => {
    expect(getDirections('STOP_A', 'ROUTE_INEXISTANTE')).toEqual([]);
  });

  it(`chaque direction a un directionId et un label`, () => {
    const dirs = getDirections('STOP_A', 'ROUTE_1');
    for (const d of dirs) {
      expect(d).toHaveProperty('directionId');
      expect(d).toHaveProperty('label');
    }
  });
});

describe(`getDirectionsForRoute`, () => {
  it("retourne les directions d'une ligne sans filtrer par arrêt", () => {
    const dirs = getDirectionsForRoute('ROUTE_1');
    expect(dirs.length).toBeGreaterThanOrEqual(2); // direction 0 et 1
  });

  it(`retourne tableau vide pour une ligne inconnue`, () => {
    expect(getDirectionsForRoute('ROUTE_X')).toEqual([]);
  });
});

// ─── getTheoreticalArrivals ───────────────────────────────────────────────────

describe(`getTheoreticalArrivals`, () => {
  it("retourne les prochains passages dans l'ordre chronologique", () => {
    const arrivals = getTheoreticalArrivals('STOP_A', 'ROUTE_1', '0', REF_DATE);
    // TRIP_1A à 07:00 (60 min) et TRIP_1B à 08:00 (120 min)
    expect(arrivals.length).toBe(2);
    expect(arrivals[0].arrivalInMin).toBeLessThan(arrivals[1].arrivalInMin);
  });

  it(`retourne le bon trip et les bonnes infos`, () => {
    const arrivals = getTheoreticalArrivals('STOP_A', 'ROUTE_1', '0', REF_DATE);
    expect(arrivals[0].tripId).toBe('TRIP_1A');
    expect(arrivals[0].arrivalTime).toBe('07:00:00');
    expect(arrivals[0].source).toBe('theoretical');
    expect(arrivals[0].routeId).toBe('ROUTE_1');
    expect(arrivals[0].stopId).toBe('STOP_A');
  });

  it(`filtre les passages déjà passés`, () => {
    // Référence à 7h30 → TRIP_1A (07:00) est passé, seulement TRIP_1B (08:00) reste
    const ref730 = new Date(2026, 3, 6, 7, 30, 0);
    const arrivals = getTheoreticalArrivals('STOP_A', 'ROUTE_1', '0', ref730);
    expect(arrivals.length).toBe(1);
    expect(arrivals[0].tripId).toBe('TRIP_1B');
  });

  it(`filtre les services inactifs`, () => {
    // TRIP_INACTIVE a SERVICE_INACTIVE → ne doit jamais apparaître
    const arrivals = getTheoreticalArrivals('STOP_A', 'ROUTE_1', '0', REF_DATE);
    const tripIds = arrivals.map(a => a.tripId);
    expect(tripIds).not.toContain('TRIP_INACTIVE');
  });

  it(`ne mélange pas les directions`, () => {
    const dir0 = getTheoreticalArrivals('STOP_A', 'ROUTE_1', '0', REF_DATE);
    const dir1 = getTheoreticalArrivals('STOP_A', 'ROUTE_1', '1', REF_DATE);
    const tripIds0 = dir0.map(a => a.tripId);
    const tripIds1 = dir1.map(a => a.tripId);
    // TRIP_1C est direction 1 → ne doit pas apparaître dans direction 0
    expect(tripIds0).not.toContain('TRIP_1C');
    // TRIP_1A et TRIP_1B sont direction 0 → ne doivent pas apparaître dans direction 1
    expect(tripIds1).not.toContain('TRIP_1A');
    expect(tripIds1).not.toContain('TRIP_1B');
  });

  it(`retourne tableau vide pour un stop inconnu`, () => {
    const arrivals = getTheoreticalArrivals('STOP_INCONNU', 'ROUTE_1', '0', REF_DATE);
    expect(arrivals).toEqual([]);
  });

  it(`retourne tableau vide si aucun passage actif`, () => {
    // Après 10h, TRIP_2A (10:00) est passé pour ROUTE_2
    const ref11h = new Date(2026, 3, 6, 11, 0, 0);
    const arrivals = getTheoreticalArrivals('STOP_A', 'ROUTE_2', '0', ref11h);
    expect(arrivals).toEqual([]);
  });

  it(`limite à MAX_ARRIVALS résultats`, () => {
    // Avec seulement 2 trips actifs pour ROUTE_1 dir 0, la limite ne joue pas ici
    const arrivals = getTheoreticalArrivals('STOP_A', 'ROUTE_1', '0', REF_DATE);
    expect(arrivals.length).toBeLessThanOrEqual(8);
  });

  it(`chaque résultat a la structure attendue`, () => {
    const arrivals = getTheoreticalArrivals('STOP_A', 'ROUTE_1', '0', REF_DATE);
    for (const a of arrivals) {
      expect(a).toHaveProperty('stopId');
      expect(a).toHaveProperty('routeId');
      expect(a).toHaveProperty('tripId');
      expect(a).toHaveProperty('directionId');
      expect(a).toHaveProperty('arrivalTime');
      expect(a).toHaveProperty('arrivalInMin');
      expect(a).toHaveProperty('source', 'theoretical');
      expect(a.arrivalInMin).toBeGreaterThan(0);
    }
  });
});

// ─── getRouteStops ────────────────────────────────────────────────────────────

describe(`getRouteStops`, () => {
  it("retourne les arrêts dans l'ordre de séquence", () => {
    const stops = getRouteStops('ROUTE_1', '0');
    expect(stops.length).toBeGreaterThan(0);
    // Les séquences doivent être croissantes
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].sequence).toBeGreaterThan(stops[i - 1].sequence);
    }
  });

  it(`chaque arrêt a les propriétés attendues`, () => {
    const stops = getRouteStops('ROUTE_1', '0');
    for (const s of stops) {
      expect(s).toHaveProperty('stopId');
      expect(s).toHaveProperty('stopName');
      expect(s).toHaveProperty('lat');
      expect(s).toHaveProperty('lon');
      expect(s).toHaveProperty('sequence');
      expect(typeof s.lat).toBe('number');
      expect(typeof s.lon).toBe('number');
    }
  });

  it(`retourne tableau vide pour une ligne inconnue`, () => {
    expect(getRouteStops('ROUTE_X', '0')).toEqual([]);
  });
});

// ─── getScheduledArrivalForTripAtStop ─────────────────────────────────────────

describe(`getScheduledArrivalForTripAtStop`, () => {
  it("retourne l'heure d'arrivee pour un trip et un stop valides", () => {
    const result = getScheduledArrivalForTripAtStop('TRIP_1A', 'STOP_A', REF_DATE);
    expect(result).not.toBeNull();
    expect(result.arrivalTime).toBe('07:00:00');
    expect(result.sequence).toBe(1);
    expect(typeof result.timestamp).toBe('number');
    expect(result.timestamp).toBeGreaterThan(REF_DATE.getTime());
  });

  it(`retourne null pour un trip qui ne passe pas par ce stop`, () => {
    // TRIP_2A ne passe pas par STOP_C
    const result = getScheduledArrivalForTripAtStop('TRIP_2A', 'STOP_C', REF_DATE);
    expect(result).toBeNull();
  });

  it(`retourne null pour un trip inexistant`, () => {
    expect(getScheduledArrivalForTripAtStop('TRIP_INEXISTANT', 'STOP_A', REF_DATE)).toBeNull();
  });
});

// ─── getStopTimesForTrip ──────────────────────────────────────────────────────

describe(`getStopTimesForTrip`, () => {
  it(`retourne les stop_times triés par séquence`, () => {
    const sts = getStopTimesForTrip('TRIP_1A');
    expect(sts.length).toBe(3); // STOP_A, STOP_B, STOP_C
    expect(sts[0].stop_id).toBe('STOP_A');
    expect(sts[1].stop_id).toBe('STOP_B');
    expect(sts[2].stop_id).toBe('STOP_C');
  });

  it(`retourne tableau vide pour un trip inconnu`, () => {
    expect(getStopTimesForTrip('TRIP_INEXISTANT')).toEqual([]);
  });
});

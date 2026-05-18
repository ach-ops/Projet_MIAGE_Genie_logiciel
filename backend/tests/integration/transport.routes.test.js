/**
 * Tests d'intégration des routes transport.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

vi.mock('../../services/gtfs.service.js', () => ({
  getAllStops: vi.fn(),
  getAllRoutes: vi.fn(),
  getRoutesByStop: vi.fn(),
  getDirections: vi.fn(),
  getDirectionsForRoute: vi.fn(),
  getRouteShape: vi.fn(),
  getRouteStops: vi.fn(),
  getStopById: vi.fn(),
  debugStop: vi.fn(),
}));

vi.mock('../../services/arrivals.service.js', () => ({
  getAllArrivals: vi.fn(),
  getArrivalsRealtime: vi.fn(),
}));

vi.mock('../../services/realtime.service.js', () => ({
  getRealtimeArrivals: vi.fn(),
  getRawFeedForStop: vi.fn(),
  getFeedRouteIds: vi.fn(),
  diagnoseStopCoverage: vi.fn(),
  resetCacheForTesting: vi.fn(),
}));

vi.mock('../../services/velib.service.js', () => ({
  getVelibStations: vi.fn(),
}));

vi.mock('swagger-jsdoc', () => ({ default: () => ({}) }));
vi.mock('swagger-ui-express', () => ({
  default: { serve: [], setup: () => (_req, _res, next) => next() },
}));

import {
  getAllStops,
  getAllRoutes,
  getRoutesByStop,
  getDirections,
  getRouteShape,
  getRouteStops,
} from '../../services/gtfs.service.js';
import { getAllArrivals, getArrivalsRealtime } from '../../services/arrivals.service.js';
import { getVelibStations } from '../../services/velib.service.js';
import { createApp } from '../../app.js';

let app;

beforeAll(() => {
  app = createApp();
});

// ─── Données de test ──────────────────────────────────────────────────────────

const STOPS = [
  { stop_id: 'STOP_A', stop_name: 'Arrêt A', stop_lat: '48.69', stop_lon: '6.18' },
  { stop_id: 'STOP_B', stop_name: 'Arrêt B', stop_lat: '48.68', stop_lon: '6.17' },
];
const ROUTES = [
  { route_id: 'ROUTE_1', route_short_name: '1', route_color: 'FF0000' },
];
const DIRECTIONS = [
  { directionId: '0', label: 'Terminus Nord' },
  { directionId: '1', label: 'Terminus Sud' },
];
const ARRIVALS = {
  stopId: 'STOP_A',
  stopName: 'Arrêt A',
  routeId: 'ROUTE_1',
  directionId: '0',
  directionName: 'Terminus Nord',
  realtime: [{ arrivalInMin: 5, source: 'realtime' }],
  theoretical: [{ arrivalTime: '08:05:00', arrivalInMin: 5, source: 'theoretical' }],
  realtimeStatus: 'ok',
  realtimeError: null,
  useTheoretical: false,
};

// ─── GET /api/stops ───────────────────────────────────────────────────────────

describe(`GET /api/stops`, () => {
  it(`retourne 200 avec la liste des arrêts`, async () => {
    getAllStops.mockReturnValue(STOPS);

    const res = await request(app).get('/api/stops');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('stop_id');
  });

  it(`retourne 200 avec tableau vide si aucun arrêt`, async () => {
    getAllStops.mockReturnValue([]);

    const res = await request(app).get('/api/stops');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── GET /api/velib/stations ─────────────────────────────────────────────────

describe('GET /api/velib/stations', () => {
  it('retourne la liste des stations Velib', async () => {
    getVelibStations.mockResolvedValue([
      {
        stationId: '1',
        name: 'Station A',
        address: 'Rue A',
        lat: 48.69,
        lon: 6.18,
        bikesAvailable: 3,
        docksAvailable: 12,
      },
    ]);

    const res = await request(app).get('/api/velib/stations');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count', 1);
    expect(res.body.stations).toHaveLength(1);
    expect(getVelibStations).toHaveBeenCalledWith(false);
  });

  it('force le refresh quand refresh=true', async () => {
    getVelibStations.mockResolvedValue([]);

    const res = await request(app).get('/api/velib/stations?refresh=true');

    expect(res.status).toBe(200);
    expect(getVelibStations).toHaveBeenCalledWith(true);
  });

  it('retourne un payload degrade sans 500 quand le service echoue', async () => {
    getVelibStations.mockRejectedValue(new Error('upstream down'));

    const res = await request(app).get('/api/velib/stations');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 0, stations: [], degraded: true });
  });
});

// ─── GET /api/routes ──────────────────────────────────────────────────────────

describe(`GET /api/routes`, () => {
  it(`retourne 200 avec la liste des lignes`, async () => {
    getAllRoutes.mockReturnValue(ROUTES);

    const res = await request(app).get('/api/routes');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

// ─── GET /api/stops/:stopId/routes ───────────────────────────────────────────

describe(`GET /api/stops/:stopId/routes`, () => {
  it(`retourne les lignes pour un arrêt valide`, async () => {
    getRoutesByStop.mockReturnValue(ROUTES);

    const res = await request(app).get('/api/stops/STOP_A/routes');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(getRoutesByStop).toHaveBeenCalledWith('STOP_A');
  });

  it(`retourne tableau vide pour un arrêt sans lignes actives`, async () => {
    getRoutesByStop.mockReturnValue([]);

    const res = await request(app).get('/api/stops/STOP_VIDE/routes');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── GET /api/stops/:stopId/routes/:routeId/directions ───────────────────────

describe(`GET /api/stops/:stopId/routes/:routeId/directions`, () => {
  it(`retourne les directions disponibles`, async () => {
    getDirections.mockReturnValue(DIRECTIONS);

    const res = await request(app).get('/api/stops/STOP_A/routes/ROUTE_1/directions');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('directionId');
    expect(res.body[0]).toHaveProperty('label');
  });

  it(`retourne tableau vide si aucune direction active`, async () => {
    getDirections.mockReturnValue([]);

    const res = await request(app).get('/api/stops/STOP_A/routes/ROUTE_1/directions');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── GET /api/stops/.../arrivals ──────────────────────────────────────────────

describe(`GET /api/stops/:stopId/routes/:routeId/directions/:directionId/arrivals`, () => {
  const URL = '/api/stops/STOP_A/routes/ROUTE_1/directions/0/arrivals';

  it(`retourne 200 avec les passages RT (ou fallback)`, async () => {
    getArrivalsRealtime.mockResolvedValue({
      stopName: 'Arrêt A',
      direction: 'Terminus Nord',
      arrivals: [{ arrivalInMin: 5, source: 'realtime' }],
      source: 'realtime',
    });

    const res = await request(app).get(URL);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('stopName', 'Arrêt A');
    expect(res.body).toHaveProperty('arrivals');
    expect(res.body.arrivals).toHaveLength(1);
  });

  it(`retourne 200 avec fallback théorique quand RT indisponible`, async () => {
    getArrivalsRealtime.mockResolvedValue({
      stopName: 'Arrêt A',
      direction: 'Terminus Nord',
      arrivals: [{ arrivalTime: '08:05:00', arrivalInMin: 5, source: 'theoretical' }],
      source: 'theoretical_fallback',
      realtimeError: 'API indisponible',
    });

    const res = await request(app).get(URL);

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('theoretical_fallback');
    expect(res.body.realtimeError).toBe('API indisponible');
  });

  it(`retourne 500 si le service lance une exception non catchée`, async () => {
    getArrivalsRealtime.mockRejectedValue(new Error('Erreur inattendue'));

    const res = await request(app).get(URL);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  it(`retourne 200 avec arrivals vide si aucun passage`, async () => {
    getArrivalsRealtime.mockResolvedValue({
      stopName: 'Arrêt A',
      direction: null,
      arrivals: [],
      source: 'realtime',
    });

    const res = await request(app).get(URL);

    expect(res.status).toBe(200);
    expect(res.body.arrivals).toEqual([]);
  });
});

// ─── GET /api/stops/.../all-arrivals ─────────────────────────────────────────

describe(`GET /api/stops/:stopId/routes/:routeId/directions/:directionId/all-arrivals`, () => {
  const URL = '/api/stops/STOP_A/routes/ROUTE_1/directions/0/all-arrivals';

  it(`retourne 200 avec RT + théorique fusionnés`, async () => {
    getAllArrivals.mockResolvedValue(ARRIVALS);

    const res = await request(app).get(URL);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('realtime');
    expect(res.body).toHaveProperty('theoretical');
    expect(res.body).toHaveProperty('realtimeStatus');
    expect(res.body).toHaveProperty('useTheoretical');
  });

  it("retourne les infos de statut RT même en cas d'erreur RT", async () => {
    getAllArrivals.mockResolvedValue({
      ...ARRIVALS,
      realtime: [],
      realtimeStatus: 'error',
      realtimeError: 'Timeout',
      useTheoretical: true,
    });

    const res = await request(app).get(URL);

    expect(res.status).toBe(200);
    expect(res.body.realtimeStatus).toBe('error');
    expect(res.body.useTheoretical).toBe(true);
  });

  it(`retourne 500 si getAllArrivals throw (exception non gérée)`, async () => {
    getAllArrivals.mockRejectedValue(new Error('crash'));

    const res = await request(app).get(URL);

    expect(res.status).toBe(500);
  });
});

// ─── GET /api/routes/:routeId/directions/:directionId/shape ──────────────────

describe(`GET /api/routes/:routeId/directions/:directionId/shape`, () => {
  it(`retourne les points du tracé`, async () => {
    getRouteShape.mockReturnValue([[48.69, 6.18], [48.68, 6.17]]);

    const res = await request(app).get('/api/routes/ROUTE_1/directions/0/shape');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('points');
    expect(res.body.points).toHaveLength(2);
  });

  it(`retourne points vide si pas de tracé`, async () => {
    getRouteShape.mockReturnValue([]);

    const res = await request(app).get('/api/routes/ROUTE_X/directions/0/shape');

    expect(res.status).toBe(200);
    expect(res.body.points).toEqual([]);
  });
});

// ─── GET /api/routes/:routeId/directions/:directionId/stops ──────────────────

describe(`GET /api/routes/:routeId/directions/:directionId/stops`, () => {
  it(`retourne les arrêts ordonnés`, async () => {
    getRouteStops.mockReturnValue([
      { stopId: 'STOP_A', stopName: 'Arrêt A', sequence: 1 },
      { stopId: 'STOP_B', stopName: 'Arrêt B', sequence: 2 },
    ]);

    const res = await request(app).get('/api/routes/ROUTE_1/directions/0/stops');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('stops');
    expect(res.body.stops).toHaveLength(2);
  });
});

// ─── Validation middleware (GTFS params invalides) ────────────────────────────

describe('validateGtfsParams — IDs invalides', () => {
  it('retourne 400 si stopId contient des caractères spéciaux', async () => {
    const res = await request(app).get('/api/stops/STOP<A>/routes');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('retourne 400 si stopId dépasse 100 caractères', async () => {
    const longId = 'A'.repeat(101);
    const res = await request(app).get(`/api/stops/${longId}/routes`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('retourne 400 si routeId contient des espaces', async () => {
    const res = await request(app).get('/api/stops/STOP_A/routes/ROUTE 1/directions');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── Healthcheck ──────────────────────────────────────────────────────────────

describe(`GET /health`, () => {
  it(`retourne 200 avec status ok`, async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });
});

// ─── Gestion d'erreurs centralisée ───────────────────────────────────────────

describe(`Middleware errorHandler`, () => {
  it(`retourne 500 avec body JSON structuré sur erreur non catchée`, async () => {
    getAllArrivals.mockRejectedValue(new Error('Erreur critique inattendue'));

    const res = await request(app)
      .get('/api/stops/STOP_A/routes/ROUTE_1/directions/0/all-arrivals');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(res.headers['content-type']).toMatch(/json/);
  });
});

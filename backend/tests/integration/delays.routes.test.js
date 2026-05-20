/**
 * Tests d'intégration des endpoints retards.
 *
 * Vérifie :
 * - GET /api/delays/average → retard moyen global
 * - GET /api/delays/by-route → retard par ligne
 * - comportement quand MongoDB est indisponible (null / tableau vide)
 * - gestion d'erreur si le service lève une exception
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../services/mongo.service.js', () => ({
  getAverageDelay: vi.fn(),
  getDelaysByRoute: vi.fn(),
}));

vi.mock('../../services/gtfs.service.js', () => ({
  getAllStops: vi.fn(() => []),
  getAllRoutes: vi.fn(() => []),
  getRoutesByStop: vi.fn(() => []),
  getDirections: vi.fn(() => []),
  getDirectionsForRoute: vi.fn(() => []),
  getRouteShape: vi.fn(() => []),
  getRouteStops: vi.fn(() => []),
  getStopById: vi.fn(() => null),
  debugStop: vi.fn(() => ({ exists: false })),
  getRouteInfo: vi.fn(() => null),
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
  getVelibStations: vi.fn(() => []),
}));

vi.mock('../../services/itinerary.service.js', () => ({
  computeItinerary: vi.fn(),
  suggestAddresses: vi.fn(),
  debugItinerary: vi.fn(),
}));

vi.mock('swagger-jsdoc', () => ({ default: () => ({}) }));
vi.mock('swagger-ui-express', () => ({
  default: { serve: [], setup: () => (_req, _res, next) => next() },
}));

import { getAverageDelay, getDelaysByRoute } from '../../services/mongo.service.js';
import { createApp } from '../../app.js';

let app;
beforeAll(() => { app = createApp(); });

// ─── GET /api/delays/average ──────────────────────────────────────────────────

describe('GET /api/delays/average', () => {
  it('retourne 200 avec une valeur numérique quand des données existent', async () => {
    getAverageDelay.mockResolvedValue(2.4);

    const res = await request(app).get('/api/delays/average');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('averageDelayMin', 2.4);
  });

  it('retourne 200 avec null quand MongoDB est indisponible', async () => {
    getAverageDelay.mockResolvedValue(null);

    const res = await request(app).get('/api/delays/average');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('averageDelayMin', null);
  });

  it('retourne 200 avec null quand aucun retard enregistré (tableau vide)', async () => {
    getAverageDelay.mockResolvedValue(null);

    const res = await request(app).get('/api/delays/average');

    expect(res.status).toBe(200);
    expect(res.body.averageDelayMin).toBeNull();
  });

  it('retourne 500 si le service lève une exception', async () => {
    getAverageDelay.mockRejectedValue(new Error('Connection refused'));

    const res = await request(app).get('/api/delays/average');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  it("retourne 200 avec 0 quand les bus sont a l'heure", async () => {
    getAverageDelay.mockResolvedValue(0);

    const res = await request(app).get('/api/delays/average');

    expect(res.status).toBe(200);
    expect(res.body.averageDelayMin).toBe(0);
  });
});

// ─── GET /api/delays/by-route ─────────────────────────────────────────────────

describe('GET /api/delays/by-route', () => {
  const DELAYS_BY_ROUTE = [
    { routeId: 'ROUTE_1', routeName: '1', color: 'FF0000', averageDelayMin: 3.2 },
    { routeId: 'ROUTE_2', routeName: '2', color: '0000FF', averageDelayMin: 0.5 },
  ];

  it('retourne 200 avec la liste des retards par ligne', async () => {
    getDelaysByRoute.mockResolvedValue(DELAYS_BY_ROUTE);

    const res = await request(app).get('/api/delays/by-route');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('routeId');
    expect(res.body[0]).toHaveProperty('routeName');
    expect(res.body[0]).toHaveProperty('averageDelayMin');
  });

  it('retourne 200 avec un tableau vide si MongoDB est indisponible', async () => {
    getDelaysByRoute.mockResolvedValue([]);

    const res = await request(app).get('/api/delays/by-route');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('retourne 200 avec un tableau vide si aucune donnée', async () => {
    getDelaysByRoute.mockResolvedValue([]);

    const res = await request(app).get('/api/delays/by-route');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('retourne 500 si le service lève une exception', async () => {
    getDelaysByRoute.mockRejectedValue(new Error('Aggregation failed'));

    const res = await request(app).get('/api/delays/by-route');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  it('retourne une ligne avec retard négatif (bus en avance)', async () => {
    getDelaysByRoute.mockResolvedValue([
      { routeId: 'ROUTE_3', routeName: '3', color: '00FF00', averageDelayMin: -1.5 },
    ]);

    const res = await request(app).get('/api/delays/by-route');

    expect(res.status).toBe(200);
    expect(res.body[0].averageDelayMin).toBe(-1.5);
  });
});

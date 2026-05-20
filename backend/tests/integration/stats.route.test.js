/**
 * Tests d'intégration de GET /api/stats/delays.
 *
 * Vérifie :
 * - retour 200 avec lines + globalAverage
 * - enrichissement routeName/color via getRouteInfo
 * - tableau vide si aucune donnée
 * - retour 500 si le service lève une exception
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../services/mongo.service.js', () => ({
  getAverageDelay:  vi.fn(),
  getDelaysByRoute: vi.fn(),
  getDelayStats:    vi.fn(),
}));

vi.mock('../../services/gtfs.service.js', () => ({
  getAllStops:         vi.fn(() => []),
  getAllRoutes:        vi.fn(() => []),
  getRoutesByStop:     vi.fn(() => []),
  getDirections:       vi.fn(() => []),
  getDirectionsForRoute: vi.fn(() => []),
  getRouteShape:       vi.fn(() => []),
  getRouteStops:       vi.fn(() => []),
  getStopById:         vi.fn(() => null),
  debugStop:           vi.fn(() => ({ exists: false })),
  getRouteInfo:        vi.fn((routeId) => ({
    routeName: routeId === 'ROUTE_1' ? '1' : '2',
    color:     routeId === 'ROUTE_1' ? '#E2001A' : '#0000FF',
  })),
}));

vi.mock('../../services/arrivals.service.js', () => ({
  getAllArrivals:    vi.fn(),
  getArrivalsRealtime: vi.fn(),
}));

vi.mock('../../services/realtime.service.js', () => ({
  getRealtimeArrivals:   vi.fn(),
  getRawFeedForStop:     vi.fn(),
  getFeedRouteIds:       vi.fn(),
  diagnoseStopCoverage:  vi.fn(),
  resetCacheForTesting:  vi.fn(),
}));

vi.mock('../../services/velib.service.js', () => ({
  getVelibStations: vi.fn(() => []),
}));

vi.mock('../../services/itinerary.service.js', () => ({
  computeItinerary:  vi.fn(),
  suggestAddresses:  vi.fn(),
  debugItinerary:    vi.fn(),
}));

vi.mock('swagger-jsdoc', () => ({ default: () => ({}) }));
vi.mock('swagger-ui-express', () => ({
  default: { serve: [], setup: () => (_req, _res, next) => next() },
}));

import { getDelayStats } from '../../services/mongo.service.js';
import { createApp } from '../../app.js';

let app;
beforeAll(() => { app = createApp(); });

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/stats/delays', () => {
  it('retourne 200 avec lines enrichies et globalAverage', async () => {
    getDelayStats.mockResolvedValue({
      lines: [
        { routeId: 'ROUTE_1', avgDelay: 2.5, samples: 10 },
        { routeId: 'ROUTE_2', avgDelay: 0.5, samples: 6 },
      ],
      globalAverage: 1.5,
    });

    const res = await request(app).get('/api/stats/delays');

    expect(res.status).toBe(200);
    expect(res.body.globalAverage).toBe(1.5);
    expect(Array.isArray(res.body.lines)).toBe(true);
    expect(res.body.lines).toHaveLength(2);

    const line = res.body.lines.find(l => l.routeId === 'ROUTE_1');
    expect(line).toMatchObject({
      routeId:   'ROUTE_1',
      routeName: '1',
      color:     '#E2001A',
      avgDelay:  2.5,
      samples:   10,
    });
  });

  it('retourne 200 avec lines vides et globalAverage 0 si aucune donnée', async () => {
    getDelayStats.mockResolvedValue({ lines: [], globalAverage: 0 });

    const res = await request(app).get('/api/stats/delays');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lines: [], globalAverage: 0 });
  });

  it('trie les lignes par routeName', async () => {
    getDelayStats.mockResolvedValue({
      lines: [
        { routeId: 'ROUTE_2', avgDelay: 1, samples: 4 },
        { routeId: 'ROUTE_1', avgDelay: 3, samples: 8 },
      ],
      globalAverage: 2,
    });

    const res = await request(app).get('/api/stats/delays');

    expect(res.status).toBe(200);
    expect(res.body.lines[0].routeName).toBe('1');
    expect(res.body.lines[1].routeName).toBe('2');
  });

  it('retourne 500 si getDelayStats lève une exception', async () => {
    getDelayStats.mockRejectedValue(new Error('Aggregation failed'));

    const res = await request(app).get('/api/stats/delays');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

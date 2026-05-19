/**
 * Tests d'intégration de la route interne /internal/compute-delays.
 * Vérifie l'authentification par token et le comportement en cas d'erreur.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../services/delay.service.js', () => ({
  computeDelays: vi.fn(),
}));

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

// ─── Setup ────────────────────────────────────────────────────────────────────

import { computeDelays } from '../../services/delay.service.js';
import { createApp } from '../../app.js';

let app;

beforeAll(() => {
  process.env.INTERNAL_TOKEN = 'test-secret-token';
  app = createApp();
});

beforeEach(() => {
  vi.mocked(computeDelays).mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /internal/compute-delays', () => {
  it('retourne 401 si le header x-internal-token est absent', async () => {
    const res = await request(app).post('/internal/compute-delays');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('retourne 401 si le token est incorrect', async () => {
    const res = await request(app)
      .post('/internal/compute-delays')
      .set('x-internal-token', 'mauvais-token');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('retourne 200 et appelle computeDelays avec le bon token', async () => {
    vi.mocked(computeDelays).mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/internal/compute-delays')
      .set('x-internal-token', 'test-secret-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(computeDelays).toHaveBeenCalledOnce();
  });

  it('retourne 500 si computeDelays lève une erreur', async () => {
    vi.mocked(computeDelays).mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app)
      .post('/internal/compute-delays')
      .set('x-internal-token', 'test-secret-token');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'DB down');
  });
});

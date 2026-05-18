/**
 * Tests d'intégration des routes travaux.
 * On teste :
 * - GET /api/travaux/incidents → 200 avec les données d'incidents
 * - GET /api/travaux/incidents → 500 si l'API externe est indisponible
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('axios');

vi.mock('swagger-jsdoc', () => ({ default: () => ({}) }));
vi.mock('swagger-ui-express', () => ({
  default: { serve: [], setup: () => (_req, _res, next) => next() },
}));

vi.mock('../../services/gtfs.service.js', () => ({
  getAllStops: vi.fn(), getAllRoutes: vi.fn(), getRoutesByStop: vi.fn(),
  getDirections: vi.fn(), getDirectionsForRoute: vi.fn(), getRouteShape: vi.fn(),
  getRouteStops: vi.fn(), getStopById: vi.fn(), debugStop: vi.fn(),
}));
vi.mock('../../services/arrivals.service.js', () => ({
  getAllArrivals: vi.fn(), getArrivalsRealtime: vi.fn(),
}));
vi.mock('../../services/realtime.service.js', () => ({
  getRealtimeArrivals: vi.fn(), getRawFeedForStop: vi.fn(),
  getFeedRouteIds: vi.fn(), diagnoseStopCoverage: vi.fn(), resetCacheForTesting: vi.fn(),
}));
vi.mock('../../services/velib.service.js', () => ({
  getVelibStations: vi.fn(),
}));
vi.mock('../../services/weather.service.js', () => ({
  default: { getWeather: vi.fn() },
}));

import axios from 'axios';
import { createApp } from '../../app.js';

let app;

beforeAll(() => {
  app = createApp();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Données de test ──────────────────────────────────────────────────────────

const INCIDENTS_RESPONSE = {
  incidents: [
    {
      id: 'INC_001',
      type: 'ROAD_CLOSED',
      description: 'Travaux rue des Carmes',
      location: { lat: 48.692, lon: 6.183 },
    },
    {
      id: 'INC_002',
      type: 'HAZARD',
      description: 'Nid de poule rue Saint-Dizier',
      location: { lat: 48.694, lon: 6.185 },
    },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/travaux/incidents', () => {
  it('retourne 200 avec les données d\'incidents de l\'API externe', async () => {
    axios.get.mockResolvedValue({ data: INCIDENTS_RESPONSE });

    const res = await request(app).get('/api/travaux/incidents');

    expect(res.status).toBe(200);
    expect(res.body.incidents).toHaveLength(2);
    expect(res.body.incidents[0].id).toBe('INC_001');
  });

  it('appelle l\'URL correcte de l\'API carto.g-ny.org', async () => {
    axios.get.mockResolvedValue({ data: {} });

    await request(app).get('/api/travaux/incidents');

    const calledUrl = axios.get.mock.calls[0][0];
    expect(calledUrl).toContain('carto.g-ny.org');
    expect(calledUrl).toContain('cifs_waze_v2.json');
  });

  it('retourne 500 si l\'API externe est indisponible', async () => {
    axios.get.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(app).get('/api/travaux/incidents');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  it('répond en JSON', async () => {
    axios.get.mockResolvedValue({ data: INCIDENTS_RESPONSE });

    const res = await request(app).get('/api/travaux/incidents');

    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('retourne les données brutes telles que renvoyées par l\'API', async () => {
    const rawData = { any_key: 'any_value', nested: { foo: 'bar' } };
    axios.get.mockResolvedValue({ data: rawData });

    const res = await request(app).get('/api/travaux/incidents');

    expect(res.body).toEqual(rawData);
  });
});

/**
 * Tests d'intégration des routes météo.
 *
 * On teste :
 * - GET /api/weather → 200 avec la structure de données
 * - GET /api/weather → 500 si le service échoue
 * - GET /api/weather → 500 si la clé API est manquante
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

vi.mock('../../services/weather.service.js', () => ({
  default: { getWeather: vi.fn() },
}));

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

import weatherService from '../../services/weather.service.js';
import { createApp } from '../../app.js';

let app;

beforeAll(() => {
  app = createApp();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/weather', () => {
  const WEATHER_RESPONSE = {
    current: {
      temp_c: 14,
      condition: { text: 'Partiellement nuageux', icon: '//cdn/day/116.png' },
      wind_kph: 20,
      humidity: 55,
    },
    forecast: {
      forecastday: [
        {
          hour: [
            { time: '2026-04-12 00:00', temp_c: 10, condition: { text: 'Clair', icon: '//cdn/night/113.png' } },
          ],
        },
      ],
    },
  };

  it('retourne 200 avec les données météo', async () => {
    weatherService.getWeather.mockResolvedValue(WEATHER_RESPONSE);

    const res = await request(app).get('/api/weather');

    expect(res.status).toBe(200);
    expect(res.body.current.temp_c).toBe(14);
    expect(res.body.forecast.forecastday).toHaveLength(1);
  });

  it('retourne 500 si le service lance une erreur générique', async () => {
    weatherService.getWeather.mockRejectedValue(new Error('Service météo KO'));

    const res = await request(app).get('/api/weather');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  it('retourne 500 avec message explicite si la clé API est manquante', async () => {
    weatherService.getWeather.mockRejectedValue(new Error('WEATHER_API_KEY manquante'));

    const res = await request(app).get('/api/weather');

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('WEATHER_API_KEY');
  });

  it('répond en JSON', async () => {
    weatherService.getWeather.mockResolvedValue(WEATHER_RESPONSE);

    const res = await request(app).get('/api/weather');

    expect(res.headers['content-type']).toMatch(/json/);
  });
});

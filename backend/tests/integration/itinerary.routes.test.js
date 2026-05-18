/**
 * Tests d'intégration des routes itinéraire.
 *
 * Vérifie :
 * - validation des entrées (400 sur params manquants/invalides)
 * - délégation au service (résultats nominaux)
 * - gestion des erreurs du service (500 avec statut)
 * - endpoint /suggest (autocomplétion)
 * - endpoint /debug
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';


vi.mock('../../services/itinerary.service.js', () => ({
  computeItinerary: vi.fn(),
  suggestAddresses: vi.fn(),
  debugItinerary: vi.fn(),
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

vi.mock('../../services/mongo.service.js', () => ({
  getAverageDelay: vi.fn(() => null),
  getDelaysByRoute: vi.fn(() => []),
}));

vi.mock('swagger-jsdoc', () => ({ default: () => ({}) }));
vi.mock('swagger-ui-express', () => ({
  default: { serve: [], setup: () => (_req, _res, next) => next() },
}));

import { computeItinerary, suggestAddresses } from '../../services/itinerary.service.js';
import { createApp } from '../../app.js';

let app;
beforeAll(() => { app = createApp(); });

// ─── Données de test ──────────────────────────────────────────────────────────

const ITINERARY_RESULT = {
  from: { address: '1 place Stanislas, Nancy', lat: 48.6936, lon: 6.1846 },
  to:   { address: '1 rue des Jardins, Nancy', lat: 48.685,  lon: 6.175 },
  walkingOption: {
    type: 'walking',
    totalDurationMin: 15,
    steps: [],
  },
  transitOptions: [
    {
      type: 'transit',
      totalDurationMin: 12,
      legs: [
        { mode: 'walk', durationMin: 3 },
        { mode: 'bus', routeId: 'ROUTE_1', routeName: '1', durationMin: 7 },
        { mode: 'walk', durationMin: 2 },
      ],
    },
  ],
};

const SUGGESTIONS = [
  { label: '1 Place Stanislas, Nancy', lat: 48.6936, lon: 6.1846 },
  { label: '1 Rue Stanislas, Nancy',  lat: 48.692,  lon: 6.183 },
];

// ─── GET /api/itinerary ───────────────────────────────────────────────────────

describe('GET /api/itinerary', () => {
  const BASE = '/api/itinerary';

  it('retourne 400 si "from" est absent', async () => {
    const res = await request(app).get(`${BASE}?to=Gare+de+Nancy`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('retourne 400 si "to" est absent', async () => {
    const res = await request(app).get(`${BASE}?from=Place+Stanislas`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('retourne 400 si les deux params sont absents', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(400);
  });

  it('retourne 400 si "from" contient une balise HTML (injection)', async () => {
    const res = await request(app)
      .get(`${BASE}?from=<script>alert(1)</script>&to=Gare+Nancy`);
    expect(res.status).toBe(400);
  });

  it('retourne 400 si "from" dépasse 200 caractères', async () => {
    const longAddr = 'a'.repeat(201);
    const res = await request(app).get(`${BASE}?from=${longAddr}&to=Gare+Nancy`);
    expect(res.status).toBe(400);
  });

  it('retourne 200 avec itinéraire calculé (cas nominal)', async () => {
    computeItinerary.mockResolvedValue(ITINERARY_RESULT);

    const res = await request(app)
      .get(`${BASE}?from=Place+Stanislas+Nancy&to=Gare+de+Nancy`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('walkingOption');
    expect(res.body).toHaveProperty('transitOptions');
    expect(Array.isArray(res.body.transitOptions)).toBe(true);
    expect(computeItinerary).toHaveBeenCalledWith(
      'Place Stanislas Nancy',
      'Gare de Nancy'
    );
  });

  it('retourne 500 si le service lève une exception générique', async () => {
    computeItinerary.mockRejectedValue(new Error('Géocodage impossible'));

    const res = await request(app)
      .get(`${BASE}?from=Adresse+inconnue&to=Autre+adresse`);

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });

  it('retourne le statut HTTP défini par le service (ex. 404)', async () => {
    const err = new Error('Adresse introuvable');
    err.status = 404;
    computeItinerary.mockRejectedValue(err);

    const res = await request(app)
      .get(`${BASE}?from=Adresse+fantôme&to=Gare+Nancy`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Adresse introuvable');
  });

  it("retourne 200 avec seulement walkingOption si pas d'option bus", async () => {
    computeItinerary.mockResolvedValue({
      ...ITINERARY_RESULT,
      transitOptions: [],
    });

    const res = await request(app)
      .get(`${BASE}?from=Place+Stanislas&to=Gare+Nancy`);

    expect(res.status).toBe(200);
    expect(res.body.transitOptions).toEqual([]);
    expect(res.body).toHaveProperty('walkingOption');
  });
});

// ─── GET /api/itinerary/suggest ───────────────────────────────────────────────

describe('GET /api/itinerary/suggest', () => {
  const BASE = '/api/itinerary/suggest';

  it('retourne [] sans appel service si q est absent', async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(suggestAddresses).not.toHaveBeenCalled();
  });

  it('retourne [] sans appel service si q fait 1 caractère (trop court)', async () => {
    suggestAddresses.mockClear();
    const res = await request(app).get(`${BASE}?q=a`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(suggestAddresses).not.toHaveBeenCalled();
  });

  it('retourne [] sans appel service si q contient des caractères invalides', async () => {
    suggestAddresses.mockClear();
    const res = await request(app).get(`${BASE}?q=<script>`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(suggestAddresses).not.toHaveBeenCalled();
  });

  it('retourne les suggestions (cas nominal)', async () => {
    suggestAddresses.mockResolvedValue(SUGGESTIONS);

    const res = await request(app).get(`${BASE}?q=Stanislas`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('label');
    expect(suggestAddresses).toHaveBeenCalledWith('Stanislas');
  });

  it('retourne [] en mode dégradé si le service échoue', async () => {
    suggestAddresses.mockRejectedValue(new Error('Geocoder timeout'));

    const res = await request(app).get(`${BASE}?q=Nancy+Gare`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});


/**
 * Tests du service arrivals — logique de fusion RT + théorique.
 *
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/gtfs.service.js', () => ({
  getTheoreticalArrivals: vi.fn(),
  getStopName: vi.fn(),
  getDirectionName: vi.fn(),
  getDirections: vi.fn(),
}));

vi.mock('../../services/realtime.service.js', () => ({
  getRealtimeArrivals: vi.fn(),
}));

import {
  getTheoreticalArrivals,
  getStopName,
  getDirectionName,
  getDirections,
} from '../../services/gtfs.service.js';
import { getRealtimeArrivals } from '../../services/realtime.service.js';
import { getAllArrivals, getArrivalsRealtime } from '../../services/arrivals.service.js';

// ─── Données de test ──────────────────────────────────────────────────────────

const STOP_ID = 'STOP_A';
const ROUTE_ID = 'ROUTE_1';
const DIRECTION_ID = '0';

const MOCK_REALTIME = [
  { stopId: STOP_ID, routeId: ROUTE_ID, tripId: 'T1', arrivalInMin: 5, source: 'realtime' },
  { stopId: STOP_ID, routeId: ROUTE_ID, tripId: 'T2', arrivalInMin: 15, source: 'realtime' },
];

const MOCK_THEORETICAL = [
  { stopId: STOP_ID, routeId: ROUTE_ID, tripId: 'T1', arrivalTime: '08:05:00', arrivalInMin: 5, source: 'theoretical' },
  { stopId: STOP_ID, routeId: ROUTE_ID, tripId: 'T2', arrivalTime: '08:15:00', arrivalInMin: 15, source: 'theoretical' },
];

beforeEach(() => {
  vi.clearAllMocks();
  getStopName.mockReturnValue('Arrêt A');
  getDirectionName.mockReturnValue('Terminus Nord');
  getDirections.mockReturnValue([{ directionId: '0', label: 'Terminus Nord' }]);
  getTheoreticalArrivals.mockReturnValue(MOCK_THEORETICAL);
  getRealtimeArrivals.mockResolvedValue(MOCK_REALTIME);
});

// ─── getAllArrivals ────────────────────────────────────────────────────────────

describe(`getAllArrivals`, () => {
  it(`retourne RT + théorique avec status ok`, async () => {
    const result = await getAllArrivals(STOP_ID, ROUTE_ID, DIRECTION_ID);

    expect(result.stopId).toBe(STOP_ID);
    expect(result.stopName).toBe('Arrêt A');
    expect(result.routeId).toBe(ROUTE_ID);
    expect(result.directionName).toBe('Terminus Nord');
    expect(result.realtime).toEqual(MOCK_REALTIME);
    expect(result.theoretical).toEqual(MOCK_THEORETICAL);
    expect(result.realtimeStatus).toBe('ok');
    expect(result.realtimeError).toBeNull();
    expect(result.useTheoretical).toBe(false);
  });

  it(`indique useTheoretical=true quand le RT est vide`, async () => {
    getRealtimeArrivals.mockResolvedValue([]);

    const result = await getAllArrivals(STOP_ID, ROUTE_ID, DIRECTION_ID);

    expect(result.realtimeStatus).toBe('empty');
    expect(result.realtime).toEqual([]);
    expect(result.theoretical).toEqual(MOCK_THEORETICAL);
    expect(result.useTheoretical).toBe(true);
  });

  it(`fallback théorique quand le RT échoue`, async () => {
    getRealtimeArrivals.mockRejectedValue(new Error('API indisponible'));

    const result = await getAllArrivals(STOP_ID, ROUTE_ID, DIRECTION_ID);

    expect(result.realtimeStatus).toBe('error');
    expect(result.realtimeError).toBe('API indisponible');
    expect(result.realtime).toEqual([]);
    expect(result.theoretical).toEqual(MOCK_THEORETICAL);
    expect(result.useTheoretical).toBe(true);
  });

  it(`ne crash pas si stopName est null (stop inconnu)`, async () => {
    getStopName.mockReturnValue(null);
    getDirectionName.mockReturnValue(null);

    const result = await getAllArrivals('STOP_INCONNU', ROUTE_ID, DIRECTION_ID);

    expect(result.stopName).toBeNull();
    expect(result.directionName).toBeNull();
    expect(result.realtimeStatus).toBe('ok');
  });

  it(`ne crash pas si le théorique est vide`, async () => {
    getTheoreticalArrivals.mockReturnValue([]);

    const result = await getAllArrivals(STOP_ID, ROUTE_ID, DIRECTION_ID);

    expect(result.theoretical).toEqual([]);
    expect(result.realtime).toEqual(MOCK_REALTIME);
  });

  it(`retourne les deux listes même quand elles sont simultanément vides`, async () => {
    getTheoreticalArrivals.mockReturnValue([]);
    getRealtimeArrivals.mockResolvedValue([]);

    const result = await getAllArrivals(STOP_ID, ROUTE_ID, DIRECTION_ID);

    expect(result.realtime).toEqual([]);
    expect(result.theoretical).toEqual([]);
    expect(result.realtimeStatus).toBe('empty');
    expect(result.useTheoretical).toBe(true);
  });

  it(`appelle bien getTheoreticalArrivals avec les bons params`, async () => {
    await getAllArrivals(STOP_ID, ROUTE_ID, DIRECTION_ID);

    expect(getTheoreticalArrivals).toHaveBeenCalledWith(STOP_ID, ROUTE_ID, DIRECTION_ID);
  });

  it(`appelle bien getRealtimeArrivals avec les bons params`, async () => {
    await getAllArrivals(STOP_ID, ROUTE_ID, DIRECTION_ID);

    expect(getRealtimeArrivals).toHaveBeenCalledWith(STOP_ID, ROUTE_ID, DIRECTION_ID);
  });
});

// ─── getArrivalsRealtime ──────────────────────────────────────────────────────

describe(`getArrivalsRealtime`, () => {
  it("retourne les passages RT avec la direction et le nom de l'arrêt", async () => {
    const result = await getArrivalsRealtime(STOP_ID, ROUTE_ID, DIRECTION_ID);

    expect(result.stopName).toBe('Arrêt A');
    expect(result.direction).toBe('Terminus Nord');
    expect(result.arrivals).toEqual(MOCK_REALTIME);
    expect(result.source).toBe('realtime');
    expect(result).not.toHaveProperty('realtimeError');
  });

  it(`fallback sur le théorique si le RT échoue`, async () => {
    getRealtimeArrivals.mockRejectedValue(new Error('Timeout'));

    const result = await getArrivalsRealtime(STOP_ID, ROUTE_ID, DIRECTION_ID);

    expect(result.source).toBe('theoretical_fallback');
    expect(result.arrivals).toEqual(MOCK_THEORETICAL);
    expect(result.realtimeError).toBe('Timeout');
    expect(result.stopName).toBe('Arrêt A');
  });

  it("direction est null si la direction n'existe pas pour cet arrêt/route", async () => {
    getDirections.mockReturnValue([]);

    const result = await getArrivalsRealtime(STOP_ID, ROUTE_ID, '99');

    expect(result.direction).toBeNull();
  });

  it("n'a pas de dynamic import — utilise getDirections statiquement (import statique testé)", async () => {
    await getArrivalsRealtime(STOP_ID, ROUTE_ID, DIRECTION_ID);
    expect(getDirections).toHaveBeenCalledWith(STOP_ID, ROUTE_ID);
  });

  it(`fallback retourne tableau vide si théorique aussi vide`, async () => {
    getRealtimeArrivals.mockRejectedValue(new Error('down'));
    getTheoreticalArrivals.mockReturnValue([]);

    const result = await getArrivalsRealtime(STOP_ID, ROUTE_ID, DIRECTION_ID);

    expect(result.source).toBe('theoretical_fallback');
    expect(result.arrivals).toEqual([]);
  });
});

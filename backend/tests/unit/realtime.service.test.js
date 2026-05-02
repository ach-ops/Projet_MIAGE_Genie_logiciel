/**
 * Tests du service GTFS-RT.
 *
 * On teste :
 * - Parsing et filtrage du feed (exact match, passé, vide)
 * - Tri et limite des résultats
 * - Comportement du cache
 * - Propagation des retards (stopTimeUpdates partiels)
 * - Gestion des erreurs réseau
 * - directionId optionnel (comportement corrigé)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NOW_UNIX,
  TS_STOP_A_10MIN,
  makeFeedSingleStop,
  makeEmptyFeed,
  makeFeedMultipleTrips,
  makeFeedWithPastArrival,
  makeTripUpdate,
  makeStopTimeUpdate,
} from '../helpers/feedFactory.js';

// ── Mocks ─────────────────────

vi.mock('axios');
vi.mock('gtfs-realtime-bindings', () => ({
  default: {
    transit_realtime: {
      FeedMessage: { decode: vi.fn() },
    },
  },
}));

// Mock du service GTFS 
vi.mock('../../services/gtfs.service.js', () => ({
  getScheduledArrivalForTripAtStop: vi.fn(),
  getStopTimesForTrip: vi.fn(),
}));

import axios from 'axios';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { getScheduledArrivalForTripAtStop, getStopTimesForTrip } from '../../services/gtfs.service.js';
import { getRealtimeArrivals, resetCacheForTesting } from '../../services/realtime.service.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

function mockFeed(feedObj) {
  axios.get.mockResolvedValue({ data: new ArrayBuffer(0) });
  GtfsRealtimeBindings.transit_realtime.FeedMessage.decode.mockReturnValue(feedObj);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetCacheForTesting();
  // Par défaut : le stop n'est pas servi par le trip dans le GTFS statique
  getScheduledArrivalForTripAtStop.mockReturnValue(null);
  getStopTimesForTrip.mockReturnValue([]);
  vi.spyOn(Date, 'now').mockReturnValue(NOW_UNIX * 1000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Cas nominal ──────────────────────────────────────────────────────────────

describe(`getRealtimeArrivals — cas nominal`, () => {
  it(`retourne un passage quand le stop est explicitement dans le feed`, async () => {
    mockFeed(makeFeedSingleStop({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN }));

    const results = await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');

    expect(results).toHaveLength(1);
    expect(results[0].stopId).toBe('STOP_A');
    expect(results[0].routeId).toBe('ROUTE_1');
    expect(results[0].arrivalTimestamp).toBe(TS_STOP_A_10MIN);
    expect(results[0].arrivalInMin).toBe(10);
    expect(results[0].source).toBe('realtime');
  });

  it(`retourne les résultats triés par timestamp croissant`, async () => {
    mockFeed(makeFeedMultipleTrips({ stopId: 'STOP_A' }));

    const results = await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');

    expect(results.length).toBeGreaterThanOrEqual(2);
    // Le premier doit être le plus proche
    expect(results[0].arrivalTimestamp).toBeLessThan(results[1].arrivalTimestamp);
    expect(results[0].arrivalInMin).toBe(5); // TS_STOP_A_5MIN
    expect(results[1].arrivalInMin).toBe(30); // TS_STOP_A_30MIN
  });

  it(`filtre les passages déjà passés`, async () => {
    mockFeed(makeFeedWithPastArrival({ stopId: 'STOP_A' }));

    const results = await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');

    expect(results).toHaveLength(0);
  });

  it(`retourne tableau vide si le feed est vide`, async () => {
    mockFeed(makeEmptyFeed());

    const results = await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');

    expect(results).toHaveLength(0);
  });

  it(`retourne tableau vide si aucun tripUpdate ne matche la route`, async () => {
    mockFeed({
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({ routeId: 'ROUTE_AUTRE', stopTimeUpdates: [
          makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN }),
        ]}),
      ],
    });

    const results = await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');

    expect(results).toHaveLength(0);
  });

  it(`retourne tableau vide si aucun stopTimeUpdate ne matche le stop`, async () => {
    mockFeed({
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({ routeId: 'ROUTE_1', stopTimeUpdates: [
          makeStopTimeUpdate({ stopId: 'STOP_B', arrivalTime: TS_STOP_A_10MIN }),
        ]}),
      ],
    });

    // STOP_A demandé, seul STOP_B dans le feed
    const results = await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');

    expect(results).toHaveLength(0);
  });
});

// ─── directionId ─────────────────────────────────────

describe(`getRealtimeArrivals — directionId optionnel`, () => {
  it(`accepte les trips sans directionId dans le feed (null)`, async () => {
    mockFeed({
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({
          routeId: 'ROUTE_1',
          directionId: null, // absent du feed
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN })],
        }),
      ],
    });

    const results = await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');

    expect(results).toHaveLength(1);
  });

  it(`filtre par directionId quand le feed le fournit`, async () => {
    mockFeed({
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({
          routeId: 'ROUTE_1',
          directionId: 1,
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN })],
        }),
      ],
    });

    // On demande direction 0 → ce trip (direction 1) doit être exclu
    const results = await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');
    expect(results).toHaveLength(0);

    // On demande direction 1 → ce trip doit être inclus
    resetCacheForTesting();
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(NOW_UNIX * 1000);
    mockFeed({
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({
          routeId: 'ROUTE_1',
          directionId: 1,
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN })],
        }),
      ],
    });
    const results2 = await getRealtimeArrivals('STOP_A', 'ROUTE_1', '1');
    expect(results2).toHaveLength(1);
  });

  it("n'utilise pas .low seul pour les timestamps (BUG historique)", async () => {
    mockFeed(makeFeedSingleStop({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN }));

    const results = await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');

    expect(results[0].arrivalInMin).toBe(10);
    expect(results[0].arrivalTimestamp).toBe(TS_STOP_A_10MIN);
  });
});

// ─── Propagation des retards ──────────────────────────────────────────────────

describe(`getRealtimeArrivals — propagation (stopTimeUpdates partiels)`, () => {
  it("propage le retard depuis un stop upstream quand le stop n'est pas dans le feed", async () => {

    const theoreticalTs = NOW_UNIX * 1000 + 10 * 60 * 1000; 
    getScheduledArrivalForTripAtStop.mockReturnValue({
      arrivalTime: '08:10:00',
      timestamp: theoreticalTs,
      sequence: 1,
    });
    getStopTimesForTrip.mockReturnValue([
      { stop_id: 'STOP_A', stop_sequence: '1' },
      { stop_id: 'STOP_B', stop_sequence: '2' },
    ]);

    const delay = 120;
    mockFeed({
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({
          tripId: 'TRIP_1A',
          routeId: 'ROUTE_1',
          stopTimeUpdates: [
            makeStopTimeUpdate({ stopId: 'STOP_B', arrivalTime: NOW_UNIX + 5 * 60, delay }),
          ],
        }),
      ],
    });

    const results = await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('realtime_estimated');
    // L'heure estimée = heure théorique + delay (en secondes)
    const expectedTs = Math.round(theoreticalTs / 1000) + delay;
    expect(results[0].arrivalTimestamp).toBe(expectedTs);
  });

  it(`skip la propagation si le trip ne sert pas ce stop (pas dans GTFS statique)`, async () => {
    getScheduledArrivalForTripAtStop.mockReturnValue(null); // trip ne passe pas par ce stop

    mockFeed({
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({
          tripId: 'TRIP_2A',
          routeId: 'ROUTE_1',
          stopTimeUpdates: [
            makeStopTimeUpdate({ stopId: 'STOP_B', arrivalTime: NOW_UNIX + 5 * 60 }),
          ],
        }),
      ],
    });

    const results = await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');
    expect(results).toHaveLength(0);
  });
});

// ─── Cache ────────────────────────────────────────────────────────────────────

describe(`getRealtimeArrivals — cache`, () => {
  it(`ne re-fetche pas si le cache est valide`, async () => {
    mockFeed(makeFeedSingleStop({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN }));

    await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');
    await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it(`re-fetche quand le cache est expiré`, async () => {
    mockFeed(makeFeedSingleStop({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN }));

    await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');

    // Simuler l'expiration du cache (avancer de 31s > CACHE_DURATION de 30s)
    vi.spyOn(Date, 'now').mockReturnValue((NOW_UNIX + 31) * 1000);

    await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');

    expect(axios.get).toHaveBeenCalledTimes(2);
  });
});

// ─── Erreurs réseau ───────────────────────────────────────────────────────────

describe(`getRealtimeArrivals — erreurs réseau`, () => {
  it("propage l'erreur réseau (pas de catch silencieux)", async () => {
    axios.get.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(getRealtimeArrivals('STOP_A', 'ROUTE_1', '0')).rejects.toThrow('ECONNREFUSED');
  });

  it(`propage une erreur de timeout`, async () => {
    const timeoutError = new Error('timeout of 10000ms exceeded');
    timeoutError.code = 'ECONNABORTED';
    axios.get.mockRejectedValue(timeoutError);

    await expect(getRealtimeArrivals('STOP_A', 'ROUTE_1', '0')).rejects.toThrow('timeout');
  });

  it(`propage une erreur de décodage protobuf`, async () => {
    axios.get.mockResolvedValue({ data: new ArrayBuffer(0) });
    GtfsRealtimeBindings.transit_realtime.FeedMessage.decode.mockImplementation(() => {
      throw new Error('invalid protobuf');
    });

    await expect(getRealtimeArrivals('STOP_A', 'ROUTE_1', '0')).rejects.toThrow('invalid protobuf');
  });
});

// ─── Limite des résultats ─────────────────────────────────────────────────────

describe(`getRealtimeArrivals — limite MAX_ARRIVALS`, () => {
  it(`limite les résultats à MAX_ARRIVALS (défaut 8)`, async () => {
    // Créer 12 trips avec des passages futurs
    const entities = Array.from({ length: 12 }, (_, i) =>
      makeTripUpdate({
        tripId: `TRIP_${i}`,
        routeId: 'ROUTE_1',
        stopTimeUpdates: [
          makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: NOW_UNIX + (i + 1) * 60 }),
        ],
      })
    );
    mockFeed({ header: { timestamp: NOW_UNIX }, entity: entities });

    const results = await getRealtimeArrivals('STOP_A', 'ROUTE_1', '0');

    expect(results.length).toBeLessThanOrEqual(8);
  });
});

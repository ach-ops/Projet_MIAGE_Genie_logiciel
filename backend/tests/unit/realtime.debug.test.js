/**
 * Tests des fonctions de debug du service GTFS-RT.
 *
 * - getRawFeedForStop  : extrait toutes les entrées d'un stop dans le feed brut
 * - getFeedRouteIds    : liste les route IDs présents dans le feed
 * - diagnoseStopCoverage : analyse combien de trips couvrent explicitement un stop
 *
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NOW_UNIX,
  TS_STOP_A_10MIN,
  TS_STOP_A_30MIN,
  makeTripUpdate,
  makeStopTimeUpdate,
} from '../helpers/feedFactory.js';

vi.mock('axios');
vi.mock('gtfs-realtime-bindings', () => ({
  default: {
    transit_realtime: {
      FeedMessage: { decode: vi.fn() },
    },
  },
}));

vi.mock('../../services/gtfs.service.js', () => ({
  getScheduledArrivalForTripAtStop: vi.fn(),
  getStopTimesForTrip: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import axios from 'axios';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { getScheduledArrivalForTripAtStop } from '../../services/gtfs.service.js';
import {
  getRawFeedForStop,
  getFeedRouteIds,
  diagnoseStopCoverage,
  resetCacheForTesting,
} from '../../services/realtime.service.js';

// ─── Helper ───────────────────────────────────────────────────────────────────

function mockFeed(feedObj) {
  axios.get.mockResolvedValue({ data: new ArrayBuffer(0) });
  GtfsRealtimeBindings.transit_realtime.FeedMessage.decode.mockReturnValue(feedObj);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetCacheForTesting();
});

// ─── getRawFeedForStop ────────────────────────────────────────────────────────

describe('getRawFeedForStop', () => {
  it('retourne les correspondances pour un stop présent dans le feed', async () => {
    const feed = {
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({
          tripId: 'TRIP_1A', routeId: 'ROUTE_1', directionId: 0,
          stopTimeUpdates: [
            makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN }),
          ],
        }),
      ],
    };
    mockFeed(feed);

    const result = await getRawFeedForStop('STOP_A');

    expect(result.matchesForStop).toHaveLength(1);
    expect(result.matchesForStop[0]).toMatchObject({
      tripId: 'TRIP_1A',
      routeId: 'ROUTE_1',
      stopId: 'STOP_A',
    });
  });

  it('retourne un tableau vide si le stop n\'est pas dans le feed', async () => {
    const feed = {
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({
          stopTimeUpdates: [
            makeStopTimeUpdate({ stopId: 'STOP_B', arrivalTime: TS_STOP_A_10MIN }),
          ],
        }),
      ],
    };
    mockFeed(feed);

    const result = await getRawFeedForStop('STOP_A');

    expect(result.matchesForStop).toHaveLength(0);
  });

  it('inclut feedTimestamp et totalEntities', async () => {
    const feed = {
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN })],
        }),
        makeTripUpdate({
          tripId: 'TRIP_2', routeId: 'ROUTE_2',
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_B', arrivalTime: TS_STOP_A_30MIN })],
        }),
      ],
    };
    mockFeed(feed);

    const result = await getRawFeedForStop('STOP_A');

    expect(result.totalEntities).toBe(2);
    expect(result.feedTimestamp).toBe(NOW_UNIX);
  });

  it('retourne plusieurs correspondances si le stop apparaît dans plusieurs trips', async () => {
    const feed = {
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({
          tripId: 'TRIP_1A', routeId: 'ROUTE_1',
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN })],
        }),
        makeTripUpdate({
          tripId: 'TRIP_1B', routeId: 'ROUTE_1',
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_30MIN })],
        }),
      ],
    };
    mockFeed(feed);

    const result = await getRawFeedForStop('STOP_A');

    expect(result.matchesForStop).toHaveLength(2);
  });

  it('mappe correctement arrival.time via longToNumber', async () => {
    const feed = {
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN })],
        }),
      ],
    };
    mockFeed(feed);

    const result = await getRawFeedForStop('STOP_A');

    expect(result.matchesForStop[0].arrival.time).toBe(TS_STOP_A_10MIN);
  });
});

// ─── getFeedRouteIds ──────────────────────────────────────────────────────────

describe('getFeedRouteIds', () => {
  it('retourne la liste triée des routeIds présents dans le feed', async () => {
    const feed = {
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({ routeId: 'ROUTE_2', stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'S', arrivalTime: TS_STOP_A_10MIN })] }),
        makeTripUpdate({ routeId: 'ROUTE_1', stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'S', arrivalTime: TS_STOP_A_10MIN })] }),
        makeTripUpdate({ tripId: 'T2', routeId: 'ROUTE_1', stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'S', arrivalTime: TS_STOP_A_30MIN })] }),
      ],
    };
    mockFeed(feed);

    const ids = await getFeedRouteIds();

    expect(ids).toEqual(['ROUTE_1', 'ROUTE_2']);
  });

  it('retourne un tableau vide si le feed est vide', async () => {
    mockFeed({ header: { timestamp: NOW_UNIX }, entity: [] });

    const ids = await getFeedRouteIds();

    expect(ids).toEqual([]);
  });

  it('ignore les entités sans tripUpdate', async () => {
    const feed = {
      header: { timestamp: NOW_UNIX },
      entity: [
        { id: 'alert_1', alert: {} },
        makeTripUpdate({ routeId: 'ROUTE_1', stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'S', arrivalTime: TS_STOP_A_10MIN })] }),
      ],
    };
    mockFeed(feed);

    const ids = await getFeedRouteIds();

    expect(ids).toEqual(['ROUTE_1']);
  });
});

// ─── diagnoseStopCoverage ────────────────────────────────────────────────────

describe('diagnoseStopCoverage', () => {
  it('retourne la structure de rapport complète', async () => {
    const feed = {
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({
          tripId: 'TRIP_1A', routeId: 'ROUTE_1', directionId: 0,
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN })],
        }),
      ],
    };
    mockFeed(feed);
    getScheduledArrivalForTripAtStop.mockReturnValue({
      arrivalTime: '08:00:00',
      timestamp: (NOW_UNIX + 3600) * 1000,
      sequence: 1,
    });

    const report = await diagnoseStopCoverage('STOP_A', 'ROUTE_1');

    expect(report).toHaveProperty('stopId', 'STOP_A');
    expect(report).toHaveProperty('routeId', 'ROUTE_1');
    expect(report).toHaveProperty('totalTripsInFeed');
    expect(report).toHaveProperty('tripsServingStop');
    expect(report).toHaveProperty('explicitInFeed');
    expect(report).toHaveProperty('partialFeed_propagationNeeded');
    expect(report).toHaveProperty('details');
  });

  it('compte correctement les trips explicites vs partiels', async () => {
    const feed = {
      header: { timestamp: NOW_UNIX },
      entity: [
        // TRIP_1A : STOP_A explicitement dans le feed
        makeTripUpdate({
          tripId: 'TRIP_1A', routeId: 'ROUTE_1',
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN })],
        }),
        // TRIP_1B : STOP_A absent du feed mais desservi selon GTFS statique → partial
        makeTripUpdate({
          tripId: 'TRIP_1B', routeId: 'ROUTE_1',
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_B', arrivalTime: TS_STOP_A_30MIN })],
        }),
      ],
    };
    mockFeed(feed);
    getScheduledArrivalForTripAtStop.mockReturnValue({
      arrivalTime: '08:00:00',
      timestamp: (NOW_UNIX + 3600) * 1000,
      sequence: 1,
    });

    const report = await diagnoseStopCoverage('STOP_A', 'ROUTE_1');

    expect(report.tripsServingStop).toBe(2);
    expect(report.explicitInFeed).toBe(1);
    expect(report.partialFeed_propagationNeeded).toBe(1);
  });

  it('filtre par routeId quand fourni', async () => {
    const feed = {
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({
          tripId: 'TRIP_1A', routeId: 'ROUTE_1',
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN })],
        }),
        makeTripUpdate({
          tripId: 'TRIP_2A', routeId: 'ROUTE_2',
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_30MIN })],
        }),
      ],
    };
    mockFeed(feed);
    getScheduledArrivalForTripAtStop.mockReturnValue(null);

    const report = await diagnoseStopCoverage('STOP_A', 'ROUTE_1');

    expect(report.totalTripsInFeed).toBe(1); // ROUTE_2 filtré
  });

  it('accepte routeId=null pour analyser toutes les routes', async () => {
    const feed = {
      header: { timestamp: NOW_UNIX },
      entity: [
        makeTripUpdate({
          tripId: 'TRIP_1A', routeId: 'ROUTE_1',
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_10MIN })],
        }),
        makeTripUpdate({
          tripId: 'TRIP_2A', routeId: 'ROUTE_2',
          stopTimeUpdates: [makeStopTimeUpdate({ stopId: 'STOP_A', arrivalTime: TS_STOP_A_30MIN })],
        }),
      ],
    };
    mockFeed(feed);
    getScheduledArrivalForTripAtStop.mockReturnValue(null);

    const report = await diagnoseStopCoverage('STOP_A', null);

    expect(report.routeId).toBe('all');
    expect(report.totalTripsInFeed).toBe(2);
  });
});

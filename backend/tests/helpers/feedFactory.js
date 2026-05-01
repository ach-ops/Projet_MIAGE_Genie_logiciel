/**
 * Fabrique d'objets GTFS-RT décodés pour les tests.
 * Reproduit la structure retournée par GtfsRealtimeBindings.FeedMessage.decode().
 */

// Timestamp de référence : 2026-04-06 08:00:00 UTC
export const NOW_UNIX = Math.floor(new Date('2026-04-06T08:00:00Z').getTime() / 1000);

// Arrêt STOP_A dans 10 min
export const TS_STOP_A_10MIN = NOW_UNIX + 10 * 60;
// Arrêt STOP_A dans 30 min
export const TS_STOP_A_30MIN = NOW_UNIX + 30 * 60;
// Arrêt STOP_A dans 5 min (proche)
export const TS_STOP_A_5MIN = NOW_UNIX + 5 * 60;
// Timestamp passé (doit être filtré)
export const TS_PAST = NOW_UNIX - 5 * 60;

/**
 * Crée une entité GTFS-RT de type tripUpdate.
 */
export function makeTripUpdate({
  tripId = 'TRIP_1A',
  routeId = 'ROUTE_1',
  directionId = null,
  stopTimeUpdates = [],
} = {}) {
  return {
    id: `entity_${tripId}`,
    tripUpdate: {
      trip: { tripId, routeId, directionId },
      stopTimeUpdate: stopTimeUpdates,
    },
  };
}

/**
 * Crée un stopTimeUpdate individuel.
 */
export function makeStopTimeUpdate({
  stopId,
  arrivalTime,
  departureTime = null,
  delay = 0,
} = {}) {
  return {
    stopId,
    arrival: arrivalTime !== undefined ? { time: arrivalTime, delay } : null,
    departure: departureTime !== undefined ? { time: departureTime ?? arrivalTime, delay } : null,
  };
}

/**
 * Feed minimaliste avec une seule entité.
 */
export function makeFeedSingleStop({ stopId = 'STOP_A', arrivalTime = TS_STOP_A_10MIN } = {}) {
  return {
    header: { gtfsRealtimeVersion: '2.0', timestamp: NOW_UNIX },
    entity: [
      makeTripUpdate({
        stopTimeUpdates: [makeStopTimeUpdate({ stopId, arrivalTime })],
      }),
    ],
  };
}

/**
 * Feed vide (aucune entité).
 */
export function makeEmptyFeed() {
  return {
    header: { gtfsRealtimeVersion: '2.0', timestamp: NOW_UNIX },
    entity: [],
  };
}

/**
 * Feed avec plusieurs trips pour tester le tri et la limite.
 */
export function makeFeedMultipleTrips({ stopId = 'STOP_A' } = {}) {
  return {
    header: { gtfsRealtimeVersion: '2.0', timestamp: NOW_UNIX },
    entity: [
      makeTripUpdate({
        tripId: 'TRIP_1B',
        routeId: 'ROUTE_1',
        stopTimeUpdates: [makeStopTimeUpdate({ stopId, arrivalTime: TS_STOP_A_30MIN })],
      }),
      makeTripUpdate({
        tripId: 'TRIP_1A',
        routeId: 'ROUTE_1',
        stopTimeUpdates: [makeStopTimeUpdate({ stopId, arrivalTime: TS_STOP_A_5MIN })],
      }),
    ],
  };
}

/**
 * Feed avec un passage déjà passé.
 */
export function makeFeedWithPastArrival({ stopId = 'STOP_A' } = {}) {
  return {
    header: { gtfsRealtimeVersion: '2.0', timestamp: NOW_UNIX },
    entity: [
      makeTripUpdate({
        stopTimeUpdates: [makeStopTimeUpdate({ stopId, arrivalTime: TS_PAST })],
      }),
    ],
  };
}

/**
 * Feed avec le trip qui ne contient PAS notre stop dans stopTimeUpdates
 * mais dont un stop (STOP_B) a un retard connu.
 */
export function makeFeedForPropagation({ delay = 120 } = {}) {
  return {
    header: { gtfsRealtimeVersion: '2.0', timestamp: NOW_UNIX },
    entity: [
      makeTripUpdate({
        tripId: 'TRIP_1A',
        routeId: 'ROUTE_1',
        stopTimeUpdates: [
          // STOP_B est dans le feed, avec un retard
          makeStopTimeUpdate({ stopId: 'STOP_B', arrivalTime: NOW_UNIX + 5 * 60, delay }),
          // STOP_A n'est PAS dans stopTimeUpdates
        ],
      }),
    ],
  };
}

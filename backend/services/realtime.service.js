import axios from "axios";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const URL =
  "https://proxy.transport.data.gouv.fr/resource/fluo-stan-nancy-gtfs-rt-trip-update";

let cache = null;
let lastFetch = 0;
const CACHE_DURATION = 15000;

async function fetchFeed() {
  const now = Date.now();

  if (cache && now - lastFetch < CACHE_DURATION) {
    return cache;
  }

  const response = await axios.get(URL, {
    responseType: "arraybuffer",
  });

  const feed =
    GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(response.data)
    );

  cache = feed;
  lastFetch = now;

  return feed;
}

export async function getRealtimeArrivals(stopId, routeId, directionId) {
  const feed = await fetchFeed();
  const now = Math.floor(Date.now() / 1000);
  const results = [];

  for (const entity of feed.entity) {
    if (!entity.tripUpdate) continue;

    const { trip, stopTimeUpdate } = entity.tripUpdate;

    if (trip.routeId !== routeId) continue;
    if (Number(trip.directionId) !== Number(directionId)) continue;

    for (const stu of stopTimeUpdate) {
      if (!stu.arrival?.time) continue;
      if (stu.stopId !== stopId) continue;

      const ts =
        typeof stu.arrival.time === "object"
          ? stu.arrival.time.low
          : stu.arrival.time;

      if (ts <= now) continue;

      results.push({
        stopId,
        routeId,
        tripId: trip.tripId,
        directionId,
        arrivalTimestamp: ts,
        arrivalInMin: Math.ceil((ts - now) / 60),
      });
    }
  }

results.sort((a, b) => a.arrivalTimestamp - b.arrivalTimestamp);

return results.slice(0, 4);
}
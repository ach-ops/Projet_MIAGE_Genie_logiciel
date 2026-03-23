import fs from "fs";
import csv from "csv-parser";
import path from "path";
import { fileURLToPath } from "url";
import { Transform } from "stream";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stops = new Map();
const routes = new Map();
const trips = new Map();
const stopTimesByStop = new Map();
const calendar = new Map();
const calendarDates = new Map();

// Fonction utilitaire pour obtenir le nom de la direction à partir du stopId, routeId et directionId
export function getDirectionName(stopId, routeId, directionId) {
  const stopTimes = stopTimesByStop.get(stopId) || [];
  for (const st of stopTimes) {
    const trip = trips.get(st.trip_id);
    if (!trip) continue;
    if (trip.route_id !== routeId) continue;
    if (String(trip.direction_id) === String(directionId)) {
      return trip.trip_headsign;
    }
  }
  return null;
}

// Fonction utilitaire pour obtenir le nom d'un arrêt à partir de son stopId
export function getStopName(stopId) {
  const stop = stops.get(stopId);
  return stop ? stop.stop_name : null;
}

function formatDateYYYYMMDD(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10).replace(/-/g, "");
}

function getWeekdayColumn(date) {
  const map = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return map[date.getDay()];
}

function getActiveServiceIds(date = new Date()) {
  const todayStr = formatDateYYYYMMDD(date);
  const weekdayCol = getWeekdayColumn(date);

  const active = new Set();

  // Calendar normal
  for (const [serviceId, row] of calendar.entries()) {
    if (
      row.start_date <= todayStr &&
      row.end_date >= todayStr &&
      row[weekdayCol] === "1"
    ) {
      active.add(serviceId);
    }
  }

  // Exceptions
  for (const [serviceId, exceptions] of calendarDates.entries()) {
    for (const ex of exceptions) {
      if (ex.date === todayStr) {
        if (ex.exception_type === "1") {
          active.add(serviceId);
        } else if (ex.exception_type === "2") {
          active.delete(serviceId);
        }
      }
    }
  }

  return active;
}

// Retourne les horaires théoriques pour un arrêt, une ligne et une direction
export function getTheoreticalArrivals(stopId, routeId, directionId) {
  const now = new Date();
  const activeServices = getActiveServiceIds();

  const stopTimes = stopTimesByStop.get(stopId) || [];
  const results = [];

  for (const st of stopTimes) {
    const trip = trips.get(st.trip_id);
    if (!trip) continue;

    if (trip.route_id !== routeId) continue;
    if (String(trip.direction_id) !== String(directionId)) continue;

    if (!activeServices.has(trip.service_id)) continue;

    const [h, m, s] = (st.arrival_time || "").split(":").map(Number);
    if (isNaN(h) || isNaN(m)) continue;

    const arrival = new Date(now);
    arrival.setHours(0, 0, 0, 0);

    let hour = h;
    if (hour >= 24) {
      hour -= 24;
      arrival.setDate(arrival.getDate() + 1);
    }

    arrival.setHours(hour, m, s || 0, 0);

    if (arrival < now) continue;

    results.push({
      stopId,
      routeId,
      tripId: trip.trip_id,
      directionId,
      arrivalTime: st.arrival_time,
      arrivalInMin: Math.ceil((arrival - now) / 60000),
    });
  }

return results.slice(0, 4);
}

function loadCalendar() {
  return new Promise((resolve, reject) => {
    const file = path.join(__dirname, "../data/gtfs/calendar.txt");

    fs.createReadStream(file)
      .pipe(removeBOM())
      .pipe(csv())
      .on("data", (row) => {
        calendar.set(row.service_id, row);
      })
      .on("end", resolve)
      .on("error", reject);
  });
}

function loadCalendarDates() {
  return new Promise((resolve, reject) => {
    const file = path.join(__dirname, "../data/gtfs/calendar_dates.txt");

    fs.createReadStream(file)
      .pipe(removeBOM())
      .pipe(csv())
      .on("data", (row) => {
        if (!calendarDates.has(row.service_id)) {
          calendarDates.set(row.service_id, []);
        }
        calendarDates.get(row.service_id).push(row);
      })
      .on("end", resolve)
      .on("error", reject);
  });
}

// Stream pour supprimer le BOM UTF-8
function removeBOM() {
  let isFirstChunk = true;
  return new Transform({
    transform(chunk, encoding, callback) {
      if (isFirstChunk) {
        isFirstChunk = false;
        if (chunk[0] === 0xef && chunk[1] === 0xbb && chunk[2] === 0xbf) {
          chunk = chunk.slice(3);
        }
      }
      callback(null, chunk);
    },
  });
}

export async function loadGTFS() {
  console.log("Chargement GTFS...");

  await loadStops();
  await loadRoutes();
  await loadTrips();
  await loadStopTimes();
  await loadCalendar();
  await loadCalendarDates();

  console.log("API GTFS chargé avec succès");
}

function loadStops() {
  return new Promise((resolve, reject) => {
    const file = path.join(__dirname, "../data/gtfs/stops.txt");

    if (!fs.existsSync(file)) {
      return reject(new Error("stops.txt introuvable"));
    }

    fs.createReadStream(file)
      .pipe(removeBOM())
      .pipe(csv())
      .on("data", (row) => {
        if (row.stop_id) {
          stops.set(row.stop_id, row);
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });
}

function loadRoutes() {
  return new Promise((resolve, reject) => {
    const file = path.join(__dirname, "../data/gtfs/routes.txt");

    fs.createReadStream(file)
      .pipe(removeBOM())
      .pipe(csv())
      .on("data", (row) => {
        if (row.route_id) {
          routes.set(row.route_id, row);
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });
}

function loadTrips() {
  return new Promise((resolve, reject) => {
    const file = path.join(__dirname, "../data/gtfs/trips.txt");

    fs.createReadStream(file)
      .pipe(removeBOM())
      .pipe(csv())
      .on("data", (row) => {
        if (row.trip_id) {
          trips.set(row.trip_id, row);
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });
}

function loadStopTimes() {
  return new Promise((resolve, reject) => {
    const file = path.join(__dirname, "../data/gtfs/stop_times.txt");

    fs.createReadStream(file)
      .pipe(removeBOM())
      .pipe(csv())
      .on("data", (row) => {
        if (!row.stop_id) return;

        if (!stopTimesByStop.has(row.stop_id)) {
          stopTimesByStop.set(row.stop_id, []);
        }

        stopTimesByStop.get(row.stop_id).push(row);
      })
      .on("end", resolve)
      .on("error", reject);
  });
}

export function getAllStops() {
  return Array.from(stops.values());
}

export function getRoutesByStop(stopId) {
  const stopTimes = stopTimesByStop.get(stopId) || [];
  const routeSet = new Set();

  for (const st of stopTimes) {
    const trip = trips.get(st.trip_id);
    if (trip) {
      routeSet.add(trip.route_id);
    }
  }

  return Array.from(routeSet)
    .map((id) => routes.get(id))
    .filter(Boolean);
}

export function getDirections(stopId, routeId) {
  const stopTimes = stopTimesByStop.get(stopId) || [];
  const directions = new Map();

  for (const st of stopTimes) {
    const trip = trips.get(st.trip_id);
    if (!trip) continue;
    if (trip.route_id !== routeId) continue;

    directions.set(trip.direction_id, trip.trip_headsign);
  }

  return Array.from(directions.entries()).map(([id, label]) => ({
    directionId: id,
    label,
  }));
}
/**
 * Service Vélib — Stations de vélos en libre-service de Nancy.
 *
 * Deux types de données récupérées :
 *  - station_information : nom, adresse, coordonnées GPS de chaque station
 *  - station_status      : vélos disponibles et places libres en temps réel
 *
 * Ordre de priorité des sources :
 *  1. Flux officiel de transport.data.gouv.fr
 *  2. Si indisponible → API directe Cyclocity Nancy
 */
import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// URL principale listant toutes les sources de données Vélib
const GBFS_ROOT_URL = 'https://transport.data.gouv.fr/gbfs/nancy/gbfs.json';

// URLs de secours 
const NANCY_STATION_INFORMATION_URL =
  'https://api.cyclocity.fr/contracts/nancy/gbfs/v2/station_information.json';
const NANCY_STATION_STATUS_URL =
  'https://api.cyclocity.fr/contracts/nancy/gbfs/v2/station_status.json';

// Durée du cache : 60 secondes
const CACHE_TTL_MS = 60_000;

let cachedAt       = 0;
let cachedStations = [];

/**
 * Extrait la liste des sources depuis la réponse principale.
 */
function resolveFeeds(gbfsData) {
  const data = gbfsData?.data;
  if (!data || typeof data !== 'object') return [];

  // Format simple
  if (Array.isArray(data.feeds)) return data.feeds;

  // Format multilingue
  const locales = Object.values(data);
  for (const locale of locales) {
    if (locale && Array.isArray(locale.feeds)) return locale.feeds;
  }

  return [];
}

// Télécharge un fichier JSON
async function fetchJson(url) {
  const res = await axios.get(url, {
    timeout: config.axiosTimeoutMs,
    headers: { Accept: 'application/json' },
  });
  return res.data;
}

/**
 * Fusionne les informations (nom, adresse, GPS) et le statut (vélos dispo)
 * en une liste de stations unifiée, triée alphabétiquement.
 */
function buildStations(stationInfo, stationStatus) {
  // Index par identifiant pour croiser infos et disponibilités
  const infoById = new Map();
  for (const station of stationInfo) {
    infoById.set(station.station_id, station);
  }

  const stations = [];
  for (const status of stationStatus) {
    const info = infoById.get(status.station_id);
    if (!info) continue;

    const lat = Number(info.lat);
    const lon = Number(info.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

    stations.push({
      stationId:      info.station_id,
      name:           info.name,
      address:        info.address || '',
      lat,
      lon,
      bikesAvailable: Number(status.num_bikes_available ?? 0), // vélos dispo
      docksAvailable: Number(status.num_docks_available ?? 0), // places libres
    });
  }

  stations.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return stations;
}

/**
 * Cherche les URLs des données de stations depuis la source principale.
 * Si indisponible, retourne les URLs directes Nancy.
 */
async function resolveStationFeedUrls() {
  try {
    const rootData = await fetchJson(GBFS_ROOT_URL);
    const feeds    = resolveFeeds(rootData);

    const infoFeed   = feeds.find(f => f.name === 'station_information');
    const statusFeed = feeds.find(f => f.name === 'station_status');

    if (infoFeed?.url && statusFeed?.url) {
      return { stationInformationUrl: infoFeed.url, stationStatusUrl: statusFeed.url };
    }

    logger.warn('GBFS root sans feeds station_* exploitables, fallback URLs Nancy directes');
  } catch (error) {
    logger.warn('GBFS root indisponible, fallback URLs Nancy directes', { message: error?.message });
  }

  return {
    stationInformationUrl: NANCY_STATION_INFORMATION_URL,
    stationStatusUrl:      NANCY_STATION_STATUS_URL,
  };
}

/**
 * Télécharge les données des stations :
 * 1. Source officielle
 * 2. Si échec → URLs directes Nancy
 */
async function fetchVelibStationsFromGbfs() {
  const { stationInformationUrl, stationStatusUrl } = await resolveStationFeedUrls();

  let infoData, statusData;

  try {
    // Téléchargement parallèle des deux flux pour réduire le temps d'attente
    [infoData, statusData] = await Promise.all([
      fetchJson(stationInformationUrl),
      fetchJson(stationStatusUrl),
    ]);
  } catch (error) {
    const alreadyUsingDirectUrls =
      stationInformationUrl === NANCY_STATION_INFORMATION_URL &&
      stationStatusUrl      === NANCY_STATION_STATUS_URL;

    // On évite une boucle infinie si on est déjà sur les URLs de secours
    if (alreadyUsingDirectUrls) throw error;

    logger.warn('Feeds GBFS resolus en echec, retry sur URLs Nancy directes', { message: error?.message });
    [infoData, statusData] = await Promise.all([
      fetchJson(NANCY_STATION_INFORMATION_URL),
      fetchJson(NANCY_STATION_STATUS_URL),
    ]);
  }

  const stationInfo   = infoData?.data?.stations  || [];
  const stationStatus = statusData?.data?.stations || [];

  return buildStations(stationInfo, stationStatus);
}

/**
 * Point d'entrée principal du service.
 * Retourne les stations Vélib.
 */
export async function getVelibStations(forceRefresh = false) {
  const now = Date.now();

  // Cache encore valide → retour direct sans appel réseau
  if (!forceRefresh && cachedStations.length > 0 && now - cachedAt < CACHE_TTL_MS) {
    return cachedStations;
  }

  try {
    const stations = await fetchVelibStationsFromGbfs();
    cachedStations = stations;
    cachedAt       = now;
    return stations;
  } catch (error) {
    // Si toutes les sources sont indisponibles mais qu'on a un cache, même ancien,
    // on le retourne plutôt que de renvoyer une erreur
    if (cachedStations.length > 0) {
      logger.warn('Velib upstream indisponible, utilisation du cache stale', {
        cachedCount: cachedStations.length,
        message:     error?.message,
      });
      return cachedStations;
    }

    throw error;
  }
}

// Réinitialise le cache
export function resetVelibCacheForTesting() {
  cachedAt       = 0;
  cachedStations = [];
}

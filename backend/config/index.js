import { logger } from '../utils/logger.js';
// Avertit dans la console si une variable importante est manquante
function warnIfMissing(key) {
  if (!process.env[key]) {
    logger.warn(`[config] Avertissement : variable d'environnement ${key} non définie.`);
  }
  return process.env[key] || '';
}

export const config = {
  // Port d'écoute du serveur Express
  port: parseInt(process.env.PORT, 10),

  // Fuseau horaire utilisé pour convertir les heures GTFS
  timeZone: process.env.APP_TIMEZONE || process.env.TZ,

  // Connexion MongoDB
  mongoUri: process.env.MONGO_URI,
  mongoDb:  process.env.MONGO_DB,

  // URL du feed GTFS-RT
  realtimeUrl:
    process.env.GTFS_RT_URL,

  // Durée de mise en cache du feed GTFS-RT
  // Évite de re-télécharger le feed à chaque requête
  realtimeCacheDuration: parseInt(process.env.CACHE_DURATION_MS, 10),

  // Nombre maximum de passages retournés par endpoint /arrivals
  maxArrivals: parseInt(process.env.MAX_ARRIVALS, 10),

  // Timeout pour tous les appels HTTP externes (météo, GTFS-RT, velib...)
  axiosTimeoutMs: parseInt(process.env.AXIOS_TIMEOUT_MS, 10),

  // Origines autorisées par le CORS (séparées par des virgules dans le .env)
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),

  // Vérifie que les variables d'environnement cors sont bien définies en production
  _checkCors: (() => {
    if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
      throw new Error('[config] CORS_ORIGINS doit être défini en production (variable d\'environnement manquante).');
    }
  })(),

  weatherApiKey: warnIfMissing('WEATHER_API_KEY'),
};

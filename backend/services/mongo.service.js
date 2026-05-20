import { MongoClient } from 'mongodb';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Fenêtre glissante pour les statistiques de retard
const STATS_WINDOW_MS = 3 * 60 * 60 * 1000;   // 3 heures
const CLEANUP_WINDOW_MS = 3 * 60 * 60 * 1000;  // on purge au-delà de 3h aussi

let client = null;
let collection = null;

export async function connectDB() {
  client = new MongoClient(config.mongoUri, {
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS:         5_000,
    socketTimeoutMS:         10_000,
  });
  await client.connect();
  const db = client.db(config.mongoDb);
  collection = db.collection('delays');

  await collection.createIndex({ routeId: 1, terminal: 1 }, { unique: true });
  await collection.createIndex({ routeId: 1 });

  let safeUri;
  try {
    const u = new URL(config.mongoUri ?? '');
    if (u.password) u.password = '****';
    safeUri = u.toString();
  } catch {
    safeUri = config.mongoUri ? '(URI non parseable)' : '';
  }
  logger.info(`MongoDB connecté → ${safeUri} / ${config.mongoDb}`);
}

/**
 * Enregistre une mesure de retard dans MongoDB.
 * Crée le document si absent, sinon ajoute la mesure à l'historique.
 */
export async function saveDelay(data) {
  if (!collection) {
    logger.warn('MongoDB indisponible : retard non enregistré', { data });
    return;
  }

  await collection.updateOne(
    { routeId: data.routeId, terminal: data.terminal },
    {
      $push: {
        delays: {
          date:  new Date(),
          delay: data.delay,
        },
      },
    },
    { upsert: true },
  );
}

/**
 * Supprime les entrées de delays datant de plus de 3h dans chaque document.
 * Ne supprime pas les documents eux-mêmes.
 */
export async function cleanOldDelays() {
  if (!collection) return;
  const limit = new Date(Date.now() - CLEANUP_WINDOW_MS);
  const result = await collection.updateMany(
    {},
    { $pull: { delays: { date: { $lt: limit } } } },
  );
  logger.info(`cleanOldDelays : ${result.modifiedCount} documents nettoyés`);
}

/**
 * Calcule les statistiques de retard sur la fenêtre glissante des 3 dernières heures.
 * Retourne la moyenne par ligne (avec samples) et la moyenne globale.
 */
export async function getDelayStats() {
  if (!collection) return { lines: [], globalAverage: 0 };

  const since = new Date(Date.now() - STATS_WINDOW_MS);

  const lines = await collection.aggregate([
    { $unwind: '$delays' },
    {
      $match: {
        'delays.delay': { $ne: null },
        'delays.date':  { $gte: since },
      },
    },
    {
      $group: {
        _id:      '$routeId',
        avgDelay: { $avg: '$delays.delay' },
        samples:  { $sum: 1 },
      },
    },
    {
      $project: {
        _id:      0,
        routeId:  '$_id',
        avgDelay: { $round: ['$avgDelay', 1] },
        samples:  1,
      },
    },
  ]).toArray();

  const totalSamples = lines.reduce((sum, l) => sum + l.samples, 0);
  const globalAverage = totalSamples > 0
    ? Math.round(lines.reduce((sum, l) => sum + l.avgDelay * l.samples, 0) / totalSamples * 10) / 10
    : 0;

  return { lines, globalAverage };
}

/**
 * Retourne le retard instantané (dernière mesure) par ligne.
 * routeName et color sont enrichis côté route handler via getRouteInfo.
 */
export async function getDelaysByRoute() {
  if (!collection) return [];

  return collection.aggregate([
    { $addFields: { lastDelay: { $last: '$delays' } } },
    { $match:     { 'lastDelay.delay': { $ne: null } } },
    {
      $group: {
        _id:      '$routeId',
        avgDelay: { $avg: '$lastDelay.delay' },
      },
    },
    {
      $project: {
        _id:             0,
        routeId:         '$_id',
        averageDelayMin: { $round: ['$avgDelay', 1] },
      },
    },
  ]).toArray();
}

/**
 * Retourne le retard moyen global (toutes lignes), basé sur la dernière mesure par terminal.
 */
export async function getAverageDelay() {
  if (!collection) return null;

  const [result] = await collection.aggregate([
    { $addFields: { lastDelay: { $last: '$delays' } } },
    { $match:     { 'lastDelay.delay': { $ne: null } } },
    { $group:     { _id: null, avg: { $avg: '$lastDelay.delay' } } },
  ]).toArray();

  if (!result) return null;
  return Math.round(result.avg * 10) / 10;
}

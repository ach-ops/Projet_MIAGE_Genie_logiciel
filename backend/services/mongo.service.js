/**
 * Service MongoDB — Stockage des retards de bus.
 *
 * Chaque document représente un terminus de ligne et contient
 * un historique de mesures de retard.
 *
 * Structure d'un document :
 * {
 *   routeId:   "LIGNE_1",
 *   terminal:  "Terminus Brabois",
 *   routeName: "1",
 *   color:     "#E2001A",
 *   delays: [
 *     { date: ISODate("2024-01-15T14:00:00Z"), delay: 2.5 },
 *   ]
 * }
 */
import { MongoClient } from 'mongodb';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Nombre max de mesures conservées par terminus (≈ 5 h d'historique).
const MAX_DELAY_ENTRIES = 288;

let client = null;
let collection = null;

/**
 * Ouvre la connexion MongoDB et prépare la collection "delays".
 * Appelé une seule fois au démarrage du serveur.
 */
export async function connectDB() {
  client = new MongoClient(config.mongoUri, {
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS:         5_000,
    socketTimeoutMS:         10_000,
  });
  await client.connect();
  const db = client.db(config.mongoDb);
  collection = db.collection('delays');

  // Index pour accélérer les recherches et éviter les doublons par ligne + terminus
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
 * Crée le document si absent, sinon ajoute la mesure à l'historique existant.
 * L'historique est limité à MAX_DELAY_ENTRIES entrées.
 */
export async function saveDelay(data) {
  if (!collection) {
    logger.warn('MongoDB indisponible : retard non enregistré', { data });
    return;
  }

  await collection.updateOne(
    { routeId: data.routeId, terminal: data.terminal },
    {
      // Met à jour le nom et la couleur de la ligne
      $set: { routeName: data.routeName, color: data.color },
      // Ajoute la mesure et supprime les plus anciennes si la limite est atteinte
      $push: {
        delays: {
          $each:  [{ date: new Date(), delay: data.delay }],
          $slice: -MAX_DELAY_ENTRIES,
        },
      },
    },
    { upsert: true }, // crée le document s'il n'existe pas encore
  );
}

/**
 * Retourne tous les documents de la collection.
 * Utilisé uniquement en interne ou pour du debug.
 */
export async function getDelays() {
  if (!collection) return [];
  return collection.find({}).toArray();
}

/**
 * Retourne le retard moyen (en minutes) pour chaque ligne.
 * Le calcul est fait directement dans MongoDB pour éviter de charger tout l'historique.
 */
export async function getDelaysByRoute() {
  if (!collection) return [];

  return collection.aggregate([
    { $unwind: '$delays' },
    { $match:  { 'delays.delay': { $ne: null } } },
    {
      $group: {
        _id:       '$routeId',
        routeName: { $first: '$routeName' },
        color:     { $first: '$color' },
        avgDelay:  { $avg: '$delays.delay' },
      },
    },
    {
      $project: {
        _id:             0,
        routeId:         '$_id',
        routeName:       1,
        color:           1,
        averageDelayMin: { $round: ['$avgDelay', 1] },
      },
    },
    { $sort: { routeName: 1 } },
  ]).toArray();
}

/**
 * Retourne le retard moyen global (toutes lignes confondues), en minutes.
 * Retourne null si aucune donnée n'est disponible.
 */
export async function getAverageDelay() {
  if (!collection) return null;

  const [result] = await collection.aggregate([
    { $unwind: '$delays' },
    { $match:  { 'delays.delay': { $ne: null } } },
    { $group:  { _id: null, avg: { $avg: '$delays.delay' } } },
  ]).toArray();

  if (!result) return null;
  return Math.round(result.avg * 10) / 10;
}

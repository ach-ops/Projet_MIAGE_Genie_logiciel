import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './services/mongo.service.js';
import { loadGTFS } from './services/gtfs.service.js';
import { startCron } from './cronjobs/delay.cron.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';

// ─── Démarrage séquentiel ──────────────────────────────────────────────────
try {
  await connectDB();
} catch (err) {
  logger.warn('MongoDB indisponible au démarrage', { err: err.message });
}

await loadGTFS();
startCron();

const app = createApp();

const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info(`Serveur démarré sur le port ${config.port}`);
});

// ─── Arrêt du serveur ──────────────────────────────────────────────────────────

function shutdown(signal) {
  logger.info(`Signal ${signal} reçu — arrêt en cours`);
  server.close(() => {
    logger.info('Serveur arrêté');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

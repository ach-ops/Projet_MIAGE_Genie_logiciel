import 'dotenv/config';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { loadGTFS } from './services/gtfs.service.js';
import { connectDB } from './services/mongo.service.js';
import { startCron } from './cronjobs/delay.cron.js';
import { createApp } from './app.js';

try {
  await connectDB();
} catch (err) {
  logger.warn('MongoDB indisponible', { message: err.message });
}

await loadGTFS();
startCron();

const app = createApp();

const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info(`API démarrée sur le port ${config.port}`);
  logger.info(`Swagger : http://localhost:${config.port}/api-docs`);
});

// Permet aux requêtes en cours de se terminer avant d'arrêter le process.
function shutdown(signal) {
  logger.info(`Signal ${signal} reçu — fermeture en cours…`);
  server.close(() => {
    logger.info('Serveur HTTP fermé. Arrêt du process.');
    process.exit(0);
  });

  // on force la fermeture si les connexions ne se libèrent pas dans les 10s
  setTimeout(() => {
    logger.error('Fermeture forcée');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

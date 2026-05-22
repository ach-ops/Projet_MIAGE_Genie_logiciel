import cron from 'node-cron';
import { computeDelays } from '../services/delay.service.js';
import { cleanOldDelays } from '../services/mongo.service.js';
import { logger } from '../utils/logger.js';

export function startCron() {
  logger.info('Cron initialisé');

  // ── Calcul des retards toutes les 30 minutes ────────────────────────────────
  cron.schedule('*/30 * * * *', async () => {
    logger.info('Cron lancé');
    try {
      await computeDelays();
      logger.info('Retards calculés et stockés');
    } catch (err) {
      logger.error('Erreur cron computeDelays', { message: err.message });
    }
  });

  // ── Nettoyage des entrées > 3h, toutes les Nuit ──────────────────────────────
  // Flag anti-chevauchement : si le nettoyage précédent tourne encore, on skip.
  let cleanupRunning = false;

  cron.schedule('0 2 * * *', async () => {
    if (cleanupRunning) {
      logger.warn('Nettoyage déjà en cours, skip.');
      return;
    }
    cleanupRunning = true;
    logger.info('Nettoyage des retards > 3h...');
    try {
      await cleanOldDelays();
      logger.info('Nettoyage terminé');
    } catch (err) {
      logger.error('Erreur cron cleanOldDelays', { message: err.message });
    } finally {
      cleanupRunning = false;
    }
  });
}

/**
 * Cron : calcul automatique des retards des bus.
 *
 * Se déclenche toutes les 15 minutes et appelle computeDelays()
 * qui compare les horaires théoriques aux données temps réel,
 * puis enregistre les résultats dans MongoDB.
 */
import cron from 'node-cron';
import { computeDelays } from '../services/delay.service.js';
import { logger } from '../utils/logger.js';

export function startCron() {
  logger.info('Cron initialisé (calcul retards toutes les 15 min)');

  cron.schedule('*/15 * * * *', async () => {

  logger.info('Cron : démarrage calcul retards');
  try {
    await computeDelays();
  } catch (err) {
    logger.error('Cron : erreur lors du calcul des retards', { message: err.message, stack: err.stack });
  }
  });
}

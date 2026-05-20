/**
 * Tests du cron de calcul des retards.
 *
 * On teste :
 * - startCron enregistre deux tâches planifiées (calcul + cleanup)
 * - La callback computeDelays est appelée correctement
 * - La callback cleanOldDelays est appelée correctement
 * - Les erreurs sont attrapées sans crash du process
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stocke chaque appel à cron.schedule dans l'ordre d'enregistrement
const scheduledJobs = [];

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((expression, callback) => {
      scheduledJobs.push({ expression, callback });
    }),
  },
}));

vi.mock('../../services/delay.service.js', () => ({
  computeDelays: vi.fn(),
}));

vi.mock('../../services/mongo.service.js', () => ({
  cleanOldDelays:   vi.fn(),
  saveDelay:        vi.fn(),
  getDelaysByRoute: vi.fn(),
  getAverageDelay:  vi.fn(),
  getDelayStats:    vi.fn(),
  connectDB:        vi.fn(),
}));

import cron from 'node-cron';
import { computeDelays } from '../../services/delay.service.js';
import { cleanOldDelays } from '../../services/mongo.service.js';
import { startCron } from '../../cronjobs/delay.cron.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  scheduledJobs.length = 0;
});

describe('startCron', () => {
  it('enregistre deux tâches cron (calcul retards + cleanup)', () => {
    startCron();

    expect(cron.schedule).toHaveBeenCalledTimes(2);
  });

  it('la première callback appelle computeDelays', async () => {
    computeDelays.mockResolvedValue(undefined);
    startCron();

    const { callback } = scheduledJobs[0]; // cron computeDelays
    await callback();

    expect(computeDelays).toHaveBeenCalledOnce();
  });

  it('la première callback attrape les erreurs de computeDelays sans crash', async () => {
    computeDelays.mockRejectedValue(new Error('Erreur RT indisponible'));
    startCron();

    const { callback } = scheduledJobs[0];
    await expect(callback()).resolves.toBeUndefined();
  });

  it('la deuxième callback appelle cleanOldDelays', async () => {
    cleanOldDelays.mockResolvedValue(undefined);
    startCron();

    const { callback } = scheduledJobs[1]; // cron cleanup
    await callback();

    expect(cleanOldDelays).toHaveBeenCalledOnce();
  });

  it('la deuxième callback attrape les erreurs de cleanOldDelays sans crash', async () => {
    cleanOldDelays.mockRejectedValue(new Error('DB timeout'));
    startCron();

    const { callback } = scheduledJobs[1];
    await expect(callback()).resolves.toBeUndefined();
  });

  it('peut être appelé plusieurs fois sans erreur', () => {
    startCron();
    startCron();

    // 2 appels × 2 schedules chacun = 4
    expect(cron.schedule).toHaveBeenCalledTimes(4);
  });
});

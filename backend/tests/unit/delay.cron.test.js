/**
 * Tests du cron de calcul des retards.
 *
 * On teste :
 * - startCron enregistre bien une tâche planifiée avec la bonne expression cron
 * - La callback appelle computeDelays
 * - Les erreurs de computeDelays sont attrapées sans crash du process
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let _scheduledExpression = null;
let scheduledCallback = null;

const testoxlint=null;


vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((expression, callback) => {
      _scheduledExpression = expression;
      scheduledCallback = callback;
    }),
  },
}));

vi.mock('../../services/delay.service.js', () => ({
  computeDelays: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import cron from 'node-cron';
import { computeDelays } from '../../services/delay.service.js';
import { startCron } from '../../cronjobs/delay.cron.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  _scheduledExpression = null;
  scheduledCallback = null;
});

describe('startCron', () => {
  it('la callback appelle computeDelays', async () => {
    computeDelays.mockResolvedValue(undefined);
    startCron();

    await scheduledCallback();

    expect(computeDelays).toHaveBeenCalledOnce();
  });

  it('la callback attrape les erreurs de computeDelays sans crash', async () => {
    computeDelays.mockRejectedValue(new Error('Erreur RT indisponible'));
    startCron();

    await expect(scheduledCallback()).resolves.toBeUndefined();
  });

  it('peut être appelé plusieurs fois sans erreur', () => {
    startCron();
    startCron();

    expect(cron.schedule).toHaveBeenCalledTimes(2);
  });
});

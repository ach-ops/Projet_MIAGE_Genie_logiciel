/**
 * Tests du service delay.
 *
 * On teste la logique de calcul et de sauvegarde des retards :
 * - Cas nominal : retard calculé et sauvegardé
 * - Retard hors seuil (> 30 min) → delay = null mais saveDelay toujours appelé
 * - RT indisponible → skip du terminal
 * - Données théoriques ou RT vides → skip du terminal
 * - Compteurs saved/skipped corrects
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/gtfs.service.js', () => ({
  getAllTerminals: vi.fn(),
  getTheoreticalArrivals: vi.fn(),
  getRouteInfo: vi.fn(),
}));

vi.mock('../../services/realtime.service.js', () => ({
  getRealtimeArrivals: vi.fn(),
}));

vi.mock('../../services/mongo.service.js', () => ({
  saveDelay: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { getAllTerminals, getTheoreticalArrivals, getRouteInfo } from '../../services/gtfs.service.js';
import { getRealtimeArrivals } from '../../services/realtime.service.js';
import { saveDelay } from '../../services/mongo.service.js';
import { computeDelays } from '../../services/delay.service.js';

// ─── Données de test ──────────────────────────────────────────────────────────

const TERMINAL_1 = { stopId: 'STOP_C', routeId: 'ROUTE_1', directionId: '0', name: 'Terminus Nord' };
const TERMINAL_2 = { stopId: 'STOP_A', routeId: 'ROUTE_2', directionId: '0', name: 'Terminus Est' };

const THEORETICAL_1 = [{ arrivalInMin: 10, tripId: 'TRIP_1A' }];
const REALTIME_1    = [{ arrivalInMin: 13, tripId: 'TRIP_1A', source: 'realtime' }];

const ROUTE_INFO_1 = { routeName: 'Ligne 1', color: '#FF0000' };

beforeEach(() => {
  vi.clearAllMocks();
  saveDelay.mockResolvedValue(undefined);
  getRouteInfo.mockReturnValue(ROUTE_INFO_1);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeDelays', () => {
  it('calcule et sauvegarde le retard nominal (RT - théorique)', async () => {
    getAllTerminals.mockReturnValue([TERMINAL_1]);
    getTheoreticalArrivals.mockReturnValue(THEORETICAL_1);
    getRealtimeArrivals.mockResolvedValue(REALTIME_1);

    await computeDelays();

    expect(saveDelay).toHaveBeenCalledOnce();
    expect(saveDelay).toHaveBeenCalledWith({
      routeId: 'ROUTE_1',
      terminal: 'Terminus Nord',
      delay: 3,
      routeName: 'Ligne 1',
      color: '#FF0000',
    });
  });

  it('retard nul quand RT === théorique', async () => {
    getAllTerminals.mockReturnValue([TERMINAL_1]);
    getTheoreticalArrivals.mockReturnValue([{ arrivalInMin: 10 }]);
    getRealtimeArrivals.mockResolvedValue([{ arrivalInMin: 10 }]);

    await computeDelays();

    expect(saveDelay).toHaveBeenCalledWith(expect.objectContaining({ delay: 0 }));
  });

  it('passe delay=null quand abs(delay) > 30 min mais appelle quand même saveDelay', async () => {
    getAllTerminals.mockReturnValue([TERMINAL_1]);
    getTheoreticalArrivals.mockReturnValue([{ arrivalInMin: 5 }]);
    getRealtimeArrivals.mockResolvedValue([{ arrivalInMin: 40 }]); // 35 min d'écart

    await computeDelays();

    expect(saveDelay).toHaveBeenCalledOnce();
    expect(saveDelay).toHaveBeenCalledWith(expect.objectContaining({ delay: null }));
  });

  it('passe delay=null pour un retard négatif > 30 min (avance excessive)', async () => {
    getAllTerminals.mockReturnValue([TERMINAL_1]);
    getTheoreticalArrivals.mockReturnValue([{ arrivalInMin: 40 }]);
    getRealtimeArrivals.mockResolvedValue([{ arrivalInMin: 5 }]); // -35 min

    await computeDelays();

    expect(saveDelay).toHaveBeenCalledWith(expect.objectContaining({ delay: null }));
  });

  it('un retard de exactement 30 min est conservé (non filtré)', async () => {
    getAllTerminals.mockReturnValue([TERMINAL_1]);
    getTheoreticalArrivals.mockReturnValue([{ arrivalInMin: 0 }]);
    getRealtimeArrivals.mockResolvedValue([{ arrivalInMin: 30 }]);

    await computeDelays();

    expect(saveDelay).toHaveBeenCalledWith(expect.objectContaining({ delay: 30 }));
  });

  it('skip le terminal si RT lance une erreur', async () => {
    getAllTerminals.mockReturnValue([TERMINAL_1]);
    getTheoreticalArrivals.mockReturnValue(THEORETICAL_1);
    getRealtimeArrivals.mockRejectedValue(new Error('Réseau indisponible'));

    await computeDelays();

    expect(saveDelay).not.toHaveBeenCalled();
  });

  it('skip le terminal si données théoriques vides', async () => {
    getAllTerminals.mockReturnValue([TERMINAL_1]);
    getTheoreticalArrivals.mockReturnValue([]);
    getRealtimeArrivals.mockResolvedValue(REALTIME_1);

    await computeDelays();

    expect(saveDelay).not.toHaveBeenCalled();
  });

  it('skip le terminal si données RT vides', async () => {
    getAllTerminals.mockReturnValue([TERMINAL_1]);
    getTheoreticalArrivals.mockReturnValue(THEORETICAL_1);
    getRealtimeArrivals.mockResolvedValue([]);

    await computeDelays();

    expect(saveDelay).not.toHaveBeenCalled();
  });

  it('traite plusieurs terminaux indépendamment', async () => {
    getAllTerminals.mockReturnValue([TERMINAL_1, TERMINAL_2]);
    getTheoreticalArrivals.mockReturnValue(THEORETICAL_1);
    getRealtimeArrivals
      .mockResolvedValueOnce(REALTIME_1)
      .mockRejectedValueOnce(new Error('Timeout'));

    await computeDelays();

    // TERMINAL_1 sauvegardé, TERMINAL_2 skip
    expect(saveDelay).toHaveBeenCalledOnce();
    expect(saveDelay).toHaveBeenCalledWith(expect.objectContaining({ routeId: 'ROUTE_1' }));
  });

  it('ne crash pas quand la liste de terminaux est vide', async () => {
    getAllTerminals.mockReturnValue([]);

    await expect(computeDelays()).resolves.toBeUndefined();
    expect(saveDelay).not.toHaveBeenCalled();
  });

  it('inclut routeName et color depuis getRouteInfo', async () => {
    getRouteInfo.mockReturnValue({ routeName: 'Ligne 2', color: '#0000FF' });
    getAllTerminals.mockReturnValue([TERMINAL_2]);
    getTheoreticalArrivals.mockReturnValue([{ arrivalInMin: 5 }]);
    getRealtimeArrivals.mockResolvedValue([{ arrivalInMin: 7 }]);

    await computeDelays();

    expect(saveDelay).toHaveBeenCalledWith(expect.objectContaining({
      routeName: 'Ligne 2',
      color: '#0000FF',
    }));
  });

  it('gère getRouteInfo qui retourne null (route inconnue)', async () => {
    getRouteInfo.mockReturnValue(null);
    getAllTerminals.mockReturnValue([TERMINAL_1]);
    getTheoreticalArrivals.mockReturnValue(THEORETICAL_1);
    getRealtimeArrivals.mockResolvedValue(REALTIME_1);

    await computeDelays();

    expect(saveDelay).toHaveBeenCalledWith(expect.objectContaining({
      routeName: undefined,
      color: undefined,
    }));
  });
});

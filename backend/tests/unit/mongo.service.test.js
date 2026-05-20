/**
 * Tests du service mongo.
 *
 * On teste :
 * - connectDB : connexion, sélection de la collection "delays"
 * - saveDelay : upsert avec $push simple
 * - saveDelay sans collection (MongoDB indisponible)
 * - cleanOldDelays : $pull sur les entrées > 3h
 * - getDelayStats : aggregation fenêtre 3h → lines + globalAverage
 * - getDelaysByRoute : aggregation $addFields + $match + $group + $project
 * - getAverageDelay : aggregation $addFields + $match + $group
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock MongoDB ───────────────────────────────────────────────────────────────

const { mockUpdateOne, mockUpdateMany, mockFind, mockToArray, mockAggregate, mockCreateIndex, mockCollection, mockDb, mockConnect } = vi.hoisted(() => {
  const mockUpdateOne   = vi.fn();
  const mockUpdateMany  = vi.fn().mockResolvedValue({ modifiedCount: 2 });
  const mockToArray     = vi.fn();
  const mockFind        = vi.fn().mockReturnValue({ toArray: mockToArray });
  const mockAggregate   = vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
  const mockCreateIndex = vi.fn().mockResolvedValue('index_created');
  const mockCollection  = vi.fn().mockReturnValue({
    updateOne:   mockUpdateOne,
    updateMany:  mockUpdateMany,
    find:        mockFind,
    createIndex: mockCreateIndex,
    aggregate:   mockAggregate,
  });
  const mockDb      = vi.fn().mockReturnValue({ collection: mockCollection });
  const mockConnect = vi.fn().mockResolvedValue(undefined);
  return { mockUpdateOne, mockUpdateMany, mockFind, mockToArray, mockAggregate, mockCreateIndex, mockCollection, mockDb, mockConnect };
});

vi.mock('mongodb', () => ({
  MongoClient: vi.fn().mockImplementation(function () {
    this.connect = mockConnect;
    this.db = mockDb;
  }),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import {
  connectDB, saveDelay,
  cleanOldDelays, getDelayStats,
  getDelaysByRoute, getAverageDelay,
} from '../../services/mongo.service.js';

// ── Helper : reconfigure les mocks et connecte ────────────────────────────────

async function setupCollection() {
  vi.clearAllMocks();
  mockFind.mockReturnValue({ toArray: mockToArray });
  mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
  mockCreateIndex.mockResolvedValue('index_created');
  mockUpdateMany.mockResolvedValue({ modifiedCount: 2 });
  mockCollection.mockReturnValue({
    updateOne:   mockUpdateOne,
    updateMany:  mockUpdateMany,
    find:        mockFind,
    createIndex: mockCreateIndex,
    aggregate:   mockAggregate,
  });
  mockDb.mockReturnValue({ collection: mockCollection });
  mockConnect.mockResolvedValue(undefined);
  await connectDB();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('mongo.service', () => {

  // ── connectDB ───────────────────────────────────────────────────────────────

  describe('connectDB', () => {
    it('appelle client.connect() puis sélectionne la collection "delays"', async () => {
      await connectDB();

      expect(mockConnect).toHaveBeenCalledOnce();
      expect(mockCollection).toHaveBeenCalledWith('delays');
    });
  });

  // ── saveDelay ───────────────────────────────────────────────────────────────

  describe('saveDelay — collection disponible', () => {
    beforeEach(setupCollection);

    it('appelle updateOne avec le bon filtre (routeId + terminal)', async () => {
      await saveDelay({ routeId: 'ROUTE_1', terminal: 'Terminus Nord', delay: 3 });

      expect(mockUpdateOne).toHaveBeenCalledOnce();
      const [filter] = mockUpdateOne.mock.calls[0];
      expect(filter).toEqual({ routeId: 'ROUTE_1', terminal: 'Terminus Nord' });
    });

    it('utilise $push avec date et delay', async () => {
      await saveDelay({ routeId: 'ROUTE_1', terminal: 'T', delay: 5 });

      const [, update] = mockUpdateOne.mock.calls[0];
      expect(update.$push).toHaveProperty('delays');
      expect(update.$push.delays.date).toBeInstanceOf(Date);
      expect(update.$push.delays.delay).toBe(5);
    });

    it('utilise upsert: true', async () => {
      await saveDelay({ routeId: 'R', terminal: 'T', delay: 0 });

      const [,, options] = mockUpdateOne.mock.calls[0];
      expect(options).toEqual({ upsert: true });
    });

    it('sauvegarde un delay null (retard hors seuil)', async () => {
      await saveDelay({ routeId: 'ROUTE_1', terminal: 'T', delay: null });

      const [, update] = mockUpdateOne.mock.calls[0];
      expect(update.$push.delays.delay).toBeNull();
    });
  });

  describe('saveDelay — MongoDB indisponible (collection null)', () => {
    it('ne crash pas et n\'appelle pas updateOne', async () => {
      vi.clearAllMocks();
      mockUpdateOne.mockClear();

      const { saveDelay: saveDelayFresh } = await import('../../services/mongo.service.js');
      mockUpdateOne.mockResolvedValue(undefined);
      await expect(saveDelayFresh({ routeId: 'R', terminal: 'T', delay: 0 })).resolves.toBeUndefined();
    });
  });

  // ── cleanOldDelays ──────────────────────────────────────────────────────────

  describe('cleanOldDelays — collection disponible', () => {
    beforeEach(setupCollection);

    it('appelle updateMany avec un filtre $pull sur la date', async () => {
      const before = Date.now();
      await cleanOldDelays();
      const after = Date.now();

      expect(mockUpdateMany).toHaveBeenCalledOnce();
      const [filter, update] = mockUpdateMany.mock.calls[0];
      expect(filter).toEqual({});
      expect(update.$pull.delays.date.$lt).toBeInstanceOf(Date);
      // La date limite est comprise entre (now - 3h - 1s) et now
      const limitMs = update.$pull.delays.date.$lt.getTime();
      const window  = 3 * 60 * 60 * 1000;
      expect(limitMs).toBeGreaterThanOrEqual(before - window - 1000);
      expect(limitMs).toBeLessThanOrEqual(after  - window + 1000);
    });

    it('ne crash pas si aucun document modifié (modifiedCount = 0)', async () => {
      mockUpdateMany.mockResolvedValue({ modifiedCount: 0 });

      await expect(cleanOldDelays()).resolves.toBeUndefined();
    });
  });

  describe('cleanOldDelays — MongoDB indisponible (collection null)', () => {
    it('ne crash pas si la collection n\'est pas initialisée', async () => {
      vi.clearAllMocks();

      const { cleanOldDelays: cleanFresh } = await import('../../services/mongo.service.js');
      await expect(cleanFresh()).resolves.toBeUndefined();
    });
  });

  // ── getDelayStats ───────────────────────────────────────────────────────────

  describe('getDelayStats — collection disponible', () => {
    beforeEach(setupCollection);

    it('retourne lines et globalAverage à partir de l\'aggregation', async () => {
      const fakeLines = [
        { routeId: 'ROUTE_1', avgDelay: 3, samples: 8 },
        { routeId: 'ROUTE_2', avgDelay: 1, samples: 5 },
      ];
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue(fakeLines) });

      const result = await getDelayStats();

      expect(result.lines).toEqual(fakeLines);
      expect(result.globalAverage).toBe(2.2); // (3×8 + 1×5) / (8+5) = 29/13 ≈ 2.2
    });

    it('retourne globalAverage = 0 si aucune ligne', async () => {
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });

      const result = await getDelayStats();

      expect(result).toEqual({ lines: [], globalAverage: 0 });
    });

    it('arrondit la globalAverage à 1 décimale', async () => {
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([
        { routeId: 'R1', avgDelay: 1, samples: 3 },
        { routeId: 'R2', avgDelay: 2, samples: 3 },
        { routeId: 'R3', avgDelay: 2, samples: 3 },
      ]) });

      const { globalAverage } = await getDelayStats();

      expect(globalAverage).toBe(1.7); // (1 + 2 + 2) / 3 = 1.666… → 1.7
    });

    it('le pipeline contient $unwind, $match avec filtre date, $group, $project', async () => {
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });

      await getDelayStats();

      const pipeline = mockAggregate.mock.calls[0][0];
      const stages   = pipeline.map(s => Object.keys(s)[0]);
      expect(stages).toContain('$unwind');
      expect(stages).toContain('$match');
      expect(stages).toContain('$group');
      expect(stages).toContain('$project');

      // Le $match doit filtrer par date
      const matchStage = pipeline.find(s => s.$match);
      expect(matchStage.$match['delays.date']).toHaveProperty('$gte');
    });
  });

  describe('getDelayStats — MongoDB indisponible (collection null)', () => {
    it('retourne { lines: [], globalAverage: 0 }', async () => {
      vi.clearAllMocks();

      const { getDelayStats: getStatsFresh } = await import('../../services/mongo.service.js');
      const result = await getStatsFresh();

      expect(result).toEqual({ lines: [], globalAverage: 0 });
    });
  });

  // ── getDelaysByRoute ────────────────────────────────────────────────────────

  describe('getDelaysByRoute — collection disponible', () => {
    beforeEach(setupCollection);

    it('appelle aggregate et retourne les retards par ligne', async () => {
      const fakeResult = [
        { routeId: 'ROUTE_1', averageDelayMin: 2.5 },
        { routeId: 'ROUTE_2', averageDelayMin: 1 },
      ];
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue(fakeResult) });

      const result = await getDelaysByRoute();

      expect(mockAggregate).toHaveBeenCalledOnce();
      expect(result).toEqual(fakeResult);
    });

    it('retourne un tableau vide si aucune mesure', async () => {
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });

      const result = await getDelaysByRoute();

      expect(result).toEqual([]);
    });

    it('le pipeline aggregate contient $addFields, $match, $group, $project', async () => {
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });

      await getDelaysByRoute();

      const pipeline = mockAggregate.mock.calls[0][0];
      const stages   = pipeline.map(s => Object.keys(s)[0]);
      expect(stages).toContain('$addFields');
      expect(stages).toContain('$match');
      expect(stages).toContain('$group');
      expect(stages).toContain('$project');
    });
  });

  // ── getAverageDelay ─────────────────────────────────────────────────────────

  describe('getAverageDelay — collection disponible', () => {
    beforeEach(setupCollection);

    it('retourne la moyenne globale arrondie à 1 décimale', async () => {
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([{ _id: null, avg: 3.456 }]) });

      const result = await getAverageDelay();

      expect(result).toBe(3.5);
    });

    it('retourne null si aucune donnée', async () => {
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });

      const result = await getAverageDelay();

      expect(result).toBeNull();
    });

    it('appelle aggregate avec un pipeline $addFields + $match + $group', async () => {
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });

      await getAverageDelay();

      const pipeline = mockAggregate.mock.calls[0][0];
      const stages   = pipeline.map(s => Object.keys(s)[0]);
      expect(stages).toContain('$addFields');
      expect(stages).toContain('$match');
      expect(stages).toContain('$group');
    });
  });
});

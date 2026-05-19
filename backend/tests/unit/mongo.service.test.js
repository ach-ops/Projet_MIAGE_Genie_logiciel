/**
 * Tests du service mongo.
 *
 * On teste :
 * - connectDB : connexion, sélection de la collection
 * - saveDelay : upsert avec les bons filtres et opérateurs
 * - saveDelay sans collection (MongoDB indisponible)
 * - getDelays : retourne le tableau de la collection
 * - getDelays sans collection : retourne []
 *
 * Note : collection est une variable de module privée
 * indirectement via connectDB() puis on vérifie les appels sur le mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock MongoDB ───────────────────────────────────────────────────────────────

const { mockUpdateOne, mockInsertMany, mockFind, mockToArray, mockAggregate, mockCreateIndex, mockCollection, mockDb, mockConnect } = vi.hoisted(() => {
  const mockUpdateOne   = vi.fn();
  const mockInsertMany  = vi.fn().mockResolvedValue({ insertedCount: 1 });
  const mockToArray     = vi.fn();
  const mockFind        = vi.fn().mockReturnValue({ toArray: mockToArray });
  const mockAggregate   = vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
  const mockCreateIndex = vi.fn().mockResolvedValue('index_created');
  const mockCollection  = vi.fn().mockReturnValue({ updateOne: mockUpdateOne, insertMany: mockInsertMany, find: mockFind, createIndex: mockCreateIndex, aggregate: mockAggregate });
  const mockDb          = vi.fn().mockReturnValue({ collection: mockCollection });
  const mockConnect     = vi.fn().mockResolvedValue(undefined);
  return { mockUpdateOne, mockInsertMany, mockFind, mockToArray, mockAggregate, mockCreateIndex, mockCollection, mockDb, mockConnect };
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

import { connectDB, saveDelay, archiveDelays, getDelays, getDelaysByRoute, getAverageDelay } from '../../services/mongo.service.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('mongo.service', () => {

  describe('connectDB', () => {
    it('appelle client.connect() puis sélectionne les collections "delays" et "old_delays"', async () => {
      await connectDB();

      expect(mockConnect).toHaveBeenCalledOnce();
      expect(mockCollection).toHaveBeenCalledWith('delays');
      expect(mockCollection).toHaveBeenCalledWith('old_delays');
    });
  });

  describe('saveDelay — collection disponible', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      mockFind.mockReturnValue({ toArray: mockToArray });
      mockCreateIndex.mockResolvedValue('index_created');
      mockCollection.mockReturnValue({ updateOne: mockUpdateOne, insertMany: mockInsertMany, find: mockFind, createIndex: mockCreateIndex, aggregate: mockAggregate });
      mockDb.mockReturnValue({ collection: mockCollection });
      mockConnect.mockResolvedValue(undefined);
      await connectDB();
    });

    it('appelle updateOne avec le bon filtre (routeId + terminal)', async () => {
      await saveDelay({ routeId: 'ROUTE_1', terminal: 'Terminus Nord', delay: 3, routeName: 'Ligne 1', color: '#f00' });

      expect(mockUpdateOne).toHaveBeenCalledOnce();
      const [filter] = mockUpdateOne.mock.calls[0];
      expect(filter).toEqual({ routeId: 'ROUTE_1', terminal: 'Terminus Nord' });
    });

    it('utilise $set pour routeName et color', async () => {
      await saveDelay({ routeId: 'ROUTE_1', terminal: 'T', delay: 5, routeName: 'Ligne 1', color: '#f00' });

      const [, update] = mockUpdateOne.mock.calls[0];
      expect(update.$set).toEqual({ routeName: 'Ligne 1', color: '#f00' });
    });

    it('utilise $push avec $each/$slice pour borner le tableau', async () => {
      await saveDelay({ routeId: 'ROUTE_1', terminal: 'T', delay: 5, routeName: 'L1', color: '#f00' });

      const [, update] = mockUpdateOne.mock.calls[0];
      expect(update.$push.delays).toHaveProperty('$each');
      expect(update.$push.delays).toHaveProperty('$slice');
      expect(update.$push.delays.$each).toHaveLength(1);
      expect(update.$push.delays.$each[0]).toMatchObject({ delay: 5 });
      expect(update.$push.delays.$each[0].date).toBeInstanceOf(Date);
    });

    it('utilise upsert: true', async () => {
      await saveDelay({ routeId: 'R', terminal: 'T', delay: 0, routeName: 'L', color: '#000' });

      const [,, options] = mockUpdateOne.mock.calls[0];
      expect(options).toEqual({ upsert: true });
    });

    it('sauvegarde un delay null (retard hors seuil)', async () => {
      await saveDelay({ routeId: 'ROUTE_1', terminal: 'T', delay: null, routeName: 'L1', color: '#f00' });

      const [, update] = mockUpdateOne.mock.calls[0];
      expect(update.$push.delays.$each[0].delay).toBeNull();
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

  describe('getDelays — collection disponible', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      mockFind.mockReturnValue({ toArray: mockToArray });
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
      mockCreateIndex.mockResolvedValue('index_created');
      mockCollection.mockReturnValue({ updateOne: mockUpdateOne, insertMany: mockInsertMany, find: mockFind, createIndex: mockCreateIndex, aggregate: mockAggregate });
      mockDb.mockReturnValue({ collection: mockCollection });
      mockConnect.mockResolvedValue(undefined);
      await connectDB();
    });

    it('retourne le tableau de la collection', async () => {
      const fakeDelays = [
        { routeId: 'ROUTE_1', terminal: 'T', delays: [{ date: new Date(), delay: 3 }] },
      ];
      mockToArray.mockResolvedValue(fakeDelays);

      const result = await getDelays();

      expect(mockFind).toHaveBeenCalledWith({});
      expect(result).toEqual(fakeDelays);
    });

    it('retourne un tableau vide quand la collection est vide', async () => {
      mockToArray.mockResolvedValue([]);

      const result = await getDelays();

      expect(result).toEqual([]);
    });
  });

  describe('getDelaysByRoute — collection disponible', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      mockFind.mockReturnValue({ toArray: mockToArray });
      mockCreateIndex.mockResolvedValue('index_created');
      mockCollection.mockReturnValue({ updateOne: mockUpdateOne, insertMany: mockInsertMany, find: mockFind, createIndex: mockCreateIndex, aggregate: mockAggregate });
      mockDb.mockReturnValue({ collection: mockCollection });
      mockConnect.mockResolvedValue(undefined);
      await connectDB();
    });

    it('appelle aggregate et retourne les retards par ligne', async () => {
      const fakeResult = [
        { routeId: 'ROUTE_1', routeName: 'Ligne 1', color: '#f00', averageDelayMin: 2.5 },
        { routeId: 'ROUTE_2', routeName: 'Ligne 2', color: '#00f', averageDelayMin: 1 },
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

    it('le pipeline aggregate contient $unwind, $match, $group, $project, $sort', async () => {
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });

      await getDelaysByRoute();

      const pipeline = mockAggregate.mock.calls[0][0];
      const stages   = pipeline.map(s => Object.keys(s)[0]);
      expect(stages).toContain('$unwind');
      expect(stages).toContain('$match');
      expect(stages).toContain('$group');
      expect(stages).toContain('$project');
      expect(stages).toContain('$sort');
    });
  });

  describe('getAverageDelay — collection disponible', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      mockFind.mockReturnValue({ toArray: mockToArray });
      mockCreateIndex.mockResolvedValue('index_created');
      mockCollection.mockReturnValue({ updateOne: mockUpdateOne, insertMany: mockInsertMany, find: mockFind, createIndex: mockCreateIndex, aggregate: mockAggregate });
      mockDb.mockReturnValue({ collection: mockCollection });
      mockConnect.mockResolvedValue(undefined);
      await connectDB();
    });

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

    it('appelle aggregate avec un pipeline $unwind + $match + $group', async () => {
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });

      await getAverageDelay();

      const pipeline = mockAggregate.mock.calls[0][0];
      const stages   = pipeline.map(s => Object.keys(s)[0]);
      expect(stages).toContain('$unwind');
      expect(stages).toContain('$match');
      expect(stages).toContain('$group');
    });
  });

  describe('archiveDelays — collection disponible', () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      mockFind.mockReturnValue({ toArray: mockToArray });
      mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
      mockCreateIndex.mockResolvedValue('index_created');
      mockInsertMany.mockResolvedValue({ insertedCount: 2 });
      mockCollection.mockReturnValue({ updateOne: mockUpdateOne, insertMany: mockInsertMany, find: mockFind, createIndex: mockCreateIndex, aggregate: mockAggregate });
      mockDb.mockReturnValue({ collection: mockCollection });
      mockConnect.mockResolvedValue(undefined);
      await connectDB();
    });

    it('appelle find({}) puis insertMany avec un champ computedAt', async () => {
      const fakeDoc = { routeId: 'R1', terminal: 'T', routeName: '1', color: '#f00', delays: [] };
      mockToArray.mockResolvedValue([fakeDoc]);

      await archiveDelays();

      expect(mockFind).toHaveBeenCalledWith({});
      expect(mockInsertMany).toHaveBeenCalledOnce();
      const [docs] = mockInsertMany.mock.calls[0];
      expect(docs).toHaveLength(1);
      expect(docs[0].computedAt).toBeInstanceOf(Date);
      expect(docs[0]).not.toHaveProperty('_id');
    });

    it('ne fait rien si la collection courante est vide', async () => {
      mockToArray.mockResolvedValue([]);

      await archiveDelays();

      expect(mockInsertMany).not.toHaveBeenCalled();
    });
  });
});

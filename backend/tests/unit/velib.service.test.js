/**
 * Tests du service vélib (stations vélo Nancy).
 *
 * On teste :
 * - Cache hit : retourne les données en cache sans rappeler axios
 * - Cache expiré : rappelle axios et rafraîchit le cache
 * - forceRefresh=true : force le rechargement même si cache valide
 * - Résolution GBFS : utilise les URLs du feed si disponibles
 * - Fallback : si GBFS root est KO → utilise les URLs directes Nancy
 * - Double fallback : si les URLs résolues échouent → retry sur URLs directes
 * - Stale cache : si tout échoue mais cache non vide → retourne le cache stale
 * - Pas de stale : si tout échoue et cache vide → propage l'erreur
 * - buildStations : tri alphabétique, coordonnées invalides filtrées
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios');
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import axios from 'axios';
import { getVelibStations, resetVelibCacheForTesting } from '../../services/velib.service.js';

// ─── Données de test ──────────────────────────────────────────────────────────

// fetchJson() retourne res.data — le corps brut de la réponse API.
// Les APIs GBFS et station renvoient un objet avec une clé "data".

const GBFS_ROOT_DIRECT = {
  data: {
    feeds: [
      { name: 'station_information', url: 'https://api.cyclocity.fr/contracts/nancy/gbfs/v2/station_information.json' },
      { name: 'station_status',      url: 'https://api.cyclocity.fr/contracts/nancy/gbfs/v2/station_status.json' },
    ],
  },
};

const GBFS_ROOT_LOCALE = {
  data: {
    fr: {
      feeds: [
        { name: 'station_information', url: 'https://resolved.example.com/station_information.json' },
        { name: 'station_status',      url: 'https://resolved.example.com/station_status.json' },
      ],
    },
  },
};

// Corps de réponse de l'API station_information.json
function makeStationInfoBody(overrides = {}) {
  return {
    data: {
      stations: [
        { station_id: 'S1', name: 'Stanislas', address: 'Place Stanislas', lat: '48.6921', lon: '6.1844' },
        { station_id: 'S2', name: 'Gare',      address: 'Rue Mazagran',    lat: '48.6900', lon: '6.1760' },
        ...( overrides.extra || []),
      ],
    },
  };
}

// Corps de réponse de l'API station_status.json
function makeStationStatusBody() {
  return {
    data: {
      stations: [
        { station_id: 'S1', num_bikes_available: 5, num_docks_available: 10 },
        { station_id: 'S2', num_bikes_available: 2, num_docks_available: 8  },
      ],
    },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetVelibCacheForTesting();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getVelibStations', () => {

  describe('cas nominal — GBFS avec feeds directs', () => {
    beforeEach(() => {
      axios.get
        .mockResolvedValueOnce({ data: GBFS_ROOT_DIRECT })
        .mockResolvedValueOnce({ data: makeStationInfoBody() })
        .mockResolvedValueOnce({ data: makeStationStatusBody() });
    });

    it('retourne un tableau de stations avec les bons champs', async () => {
      const stations = await getVelibStations();

      expect(stations).toHaveLength(2);
      expect(stations[0]).toMatchObject({
        stationId: expect.any(String),
        name: expect.any(String),
        lat: expect.any(Number),
        lon: expect.any(Number),
        bikesAvailable: expect.any(Number),
        docksAvailable: expect.any(Number),
      });
    });

    it('tri les stations par nom alphabétique', async () => {
      const stations = await getVelibStations();

      const names = stations.map(s => s.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'fr')));
    });

    it('mappe correctement les données (bikes + docks)', async () => {
      const stations = await getVelibStations();

      const stanislas = stations.find(s => s.stationId === 'S1');
      expect(stanislas.bikesAvailable).toBe(5);
      expect(stanislas.docksAvailable).toBe(10);
    });
  });

  describe('cache', () => {
    it('retourne le cache sans rappeler axios si TTL valide', async () => {
      axios.get
        .mockResolvedValueOnce({ data: GBFS_ROOT_DIRECT })
        .mockResolvedValueOnce({ data: makeStationInfoBody() })
        .mockResolvedValueOnce({ data: makeStationStatusBody() });

      await getVelibStations();
      await getVelibStations();

      expect(axios.get).toHaveBeenCalledTimes(3); 
    });

    it('forceRefresh=true contourne le cache', async () => {
      axios.get
        .mockResolvedValueOnce({ data: GBFS_ROOT_DIRECT })
        .mockResolvedValueOnce({ data: makeStationInfoBody() })
        .mockResolvedValueOnce({ data: makeStationStatusBody() })
        .mockResolvedValueOnce({ data: GBFS_ROOT_DIRECT })
        .mockResolvedValueOnce({ data: makeStationInfoBody() })
        .mockResolvedValueOnce({ data: makeStationStatusBody() });

      await getVelibStations(false);
      await getVelibStations(true); // force refresh

      expect(axios.get).toHaveBeenCalledTimes(6);
    });
  });

  describe('résolution GBFS — format locale', () => {
    it('gère la structure data.fr.feeds (format localisé)', async () => {
      axios.get
        .mockResolvedValueOnce({ data: GBFS_ROOT_LOCALE })
        .mockResolvedValueOnce({ data: makeStationInfoBody() })
        .mockResolvedValueOnce({ data: makeStationStatusBody() });

      const stations = await getVelibStations();

      expect(stations.length).toBeGreaterThan(0);
      // Vérifie que les URLs résolues du locale ont été utilisées
      const calledUrls = axios.get.mock.calls.map(c => c[0]);
      expect(calledUrls).toContain('https://resolved.example.com/station_information.json');
    });
  });

  describe('fallbacks', () => {
    it('utilise les URLs directes si GBFS root est indisponible', async () => {
      axios.get
        .mockRejectedValueOnce(new Error('GBFS root KO')) 
        .mockResolvedValueOnce({ data: makeStationInfoBody() })
        .mockResolvedValueOnce({ data: makeStationStatusBody() });

      const stations = await getVelibStations();

      expect(stations).toHaveLength(2);
    });

    it('retry sur URLs directes si les URLs résolues échouent', async () => {
      const customGbfs = {
        data: {
          feeds: [
            { name: 'station_information', url: 'https://custom.example.com/info.json' },
            { name: 'station_status',      url: 'https://custom.example.com/status.json' },
          ],
        },
      };

      axios.get
        .mockResolvedValueOnce({ data: customGbfs })           
        .mockRejectedValueOnce(new Error('Custom URL KO'))  
        .mockRejectedValueOnce(new Error('Custom URL KO')) 
        .mockResolvedValueOnce({ data: makeStationInfoBody() })
        .mockResolvedValueOnce({ data: makeStationStatusBody() });

      const stations = await getVelibStations();

      expect(stations).toHaveLength(2);
    });

    it('retourne le cache stale si tout échoue mais cache non vide', async () => {
      // Remplir le cache
      axios.get
        .mockResolvedValueOnce({ data: GBFS_ROOT_DIRECT })
        .mockResolvedValueOnce({ data: makeStationInfoBody() })
        .mockResolvedValueOnce({ data: makeStationStatusBody() });
      await getVelibStations();

      axios.get.mockRejectedValue(new Error('Tout est KO'));

      const stations = await getVelibStations(true);

      expect(stations).toHaveLength(2); // retourne le stale cache
    });

    it('propage l\'erreur si cache vide et tout échoue', async () => {
      axios.get.mockRejectedValue(new Error('Indisponible'));

      await expect(getVelibStations()).rejects.toThrow('Indisponible');
    });
  });

  describe('buildStations — filtrage et conversion', () => {
    it('ignore les stations avec des coordonnées invalides (NaN)', async () => {
      const infoWithBad = {
        data: {
          stations: [
            { station_id: 'S1', name: 'Stanislas', lat: '48.69', lon: '6.18' },
            { station_id: 'S_BAD', name: 'Mauvaise', lat: 'invalid', lon: 'invalid' },
          ],
        },
      };
      const statusAll = {
        data: {
          stations: [
            { station_id: 'S1',    num_bikes_available: 3, num_docks_available: 7 },
            { station_id: 'S_BAD', num_bikes_available: 1, num_docks_available: 2 },
          ],
        },
      };

      axios.get
        .mockResolvedValueOnce({ data: GBFS_ROOT_DIRECT })
        .mockResolvedValueOnce({ data: infoWithBad })
        .mockResolvedValueOnce({ data: statusAll });

      const stations = await getVelibStations();

      expect(stations.every(s => !Number.isNaN(s.lat) && !Number.isNaN(s.lon))).toBe(true);
      expect(stations.find(s => s.stationId === 'S_BAD')).toBeUndefined();
    });

    it('ignore les statuts sans info correspondante', async () => {
      const infoOnly1 = {
        data: { stations: [{ station_id: 'S1', name: 'Stanislas', lat: '48.69', lon: '6.18' }] },
      };
      const statusWith2 = {
        data: {
          stations: [
            { station_id: 'S1', num_bikes_available: 3, num_docks_available: 7 },
            { station_id: 'S_ORPHAN', num_bikes_available: 1, num_docks_available: 2 },
          ],
        },
      };

      axios.get
        .mockResolvedValueOnce({ data: GBFS_ROOT_DIRECT })
        .mockResolvedValueOnce({ data: infoOnly1 })
        .mockResolvedValueOnce({ data: statusWith2 });

      const stations = await getVelibStations();

      expect(stations).toHaveLength(1);
      expect(stations[0].stationId).toBe('S1');
    });
  });
});

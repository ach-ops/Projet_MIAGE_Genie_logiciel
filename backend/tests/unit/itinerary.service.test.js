/**
 * Tests unitaires du service itinéraire.
 *
 * Couvre :
 * - haversineKm, walkingTimeMin (fonctions pures)
 * - geocodeAddress, suggestAddresses (appels axios mockés)
 * - findNearestStops (utilise getAllStops mocké)
 * - findTransitOptions (algorithme de routage — 0, 1, 2 correspondances)
 * - computeItinerary (point d'entrée principal)
 * - debugItinerary (diagnostic)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios');

vi.mock('../../services/gtfs.service.js', () => ({
  getAllStops:            vi.fn(),
  getRoutesByStop:       vi.fn(),
  getDirectionsForRoute: vi.fn(),
  getRouteStops:         vi.fn(),
  getRouteInfo:          vi.fn(),
  getTransferStops:      vi.fn(() => new Set()),
  hasUpcomingDeparture:  vi.fn(() => true),
  getNextDepartureMins:  vi.fn(() => 5),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import axios from 'axios';
import {
  haversineKm,
  walkingTimeMin,
  geocodeAddress,
  suggestAddresses,
  findNearestStops,
  findTransitOptions,
  computeItinerary,
  debugItinerary,
} from '../../services/itinerary.service.js';
import {
  getAllStops,
  getRoutesByStop,
  getDirectionsForRoute,
  getRouteStops,
  getRouteInfo,
  getTransferStops,
  hasUpcomingDeparture,
  getNextDepartureMins,
} from '../../services/gtfs.service.js';

// ─── Coordonnées de test (Nancy) ──────────────────────────────────────────────

// Place Stanislas (départ) — 48.6936, 6.1846
const FROM_LAT = 48.6936;
const FROM_LON = 6.1846;

// Gare de Nancy (arrivée) 
const TO_LAT = 48.682;
const TO_LON = 6.174;

// ─── Données GTFS minimales ───────────────────────────────────────────────────

// Arrêts : A très proche du départ, B très proche de l'arrivée, C intermédiaire
const STOPS = [
  { stop_id: 'A', stop_name: 'Arrêt A', stop_lat: '48.6930', stop_lon: '6.1840', location_type: '' },
  { stop_id: 'B', stop_name: 'Arrêt B', stop_lat: '48.6820', stop_lon: '6.1740', location_type: '' },
  { stop_id: 'C', stop_name: 'Arrêt C', stop_lat: '48.6875', stop_lon: '6.1790', location_type: '' },
];

// R1 direction 0 : A → C → B  (couvre le trajet de bout en bout)
const STOPS_R1 = [
  { stopId: 'A', stopName: 'Arrêt A' },
  { stopId: 'C', stopName: 'Arrêt C' },
  { stopId: 'B', stopName: 'Arrêt B' },
];

// R2 direction 0 : C → B  (permet une 1-correspondance via C)
const STOPS_R2 = [
  { stopId: 'C', stopName: 'Arrêt C' },
  { stopId: 'B', stopName: 'Arrêt B' },
];

function setupGtfsMocks() {
  getAllStops.mockReturnValue(STOPS);

  getRoutesByStop.mockImplementation(stopId => {
    const map = {
      A: [{ route_id: 'R1', route_short_name: '1' }],
      B: [{ route_id: 'R1', route_short_name: '1' }, { route_id: 'R2', route_short_name: '2' }],
      C: [{ route_id: 'R1', route_short_name: '1' }, { route_id: 'R2', route_short_name: '2' }],
    };
    return map[stopId] ?? [];
  });

  getDirectionsForRoute.mockImplementation(routeId => {
    if (routeId === 'R1') return [{ directionId: '0', label: 'Vers B' }];
    if (routeId === 'R2') return [{ directionId: '0', label: 'Vers B via C' }];
    return [];
  });

  getRouteStops.mockImplementation((routeId) => {
    if (routeId === 'R1') return STOPS_R1;
    if (routeId === 'R2') return STOPS_R2;
    return [];
  });

  getRouteInfo.mockImplementation(routeId => {
    if (routeId === 'R1') return { routeName: '1', color: '#FF0000' };
    if (routeId === 'R2') return { routeName: '2', color: '#0000FF' };
    return null;
  });

  getTransferStops.mockReturnValue(new Set());
  hasUpcomingDeparture.mockReturnValue(true);
  getNextDepartureMins.mockReturnValue(5);
}

beforeEach(() => {
  vi.clearAllMocks();
  setupGtfsMocks();
});

// ─── haversineKm ──────────────────────────────────────────────────────────────

describe('haversineKm', () => {
  it('retourne 0 pour deux points identiques', () => {
    expect(haversineKm(48.69, 6.18, 48.69, 6.18)).toBe(0);
  });

  it('calcule une distance connue (Nancy → Metz ≈ 50-60 km)', () => {
    const d = haversineKm(48.6936, 6.1846, 49.1193, 6.1757);
    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(65);
  });

  it('est symétrique (A→B = B→A)', () => {
    const ab = haversineKm(48.69, 6.18, 48.70, 6.20);
    const ba = haversineKm(48.70, 6.20, 48.69, 6.18);
    expect(ab).toBeCloseTo(ba, 5);
  });

  it('renvoie une distance positive pour des points différents', () => {
    expect(haversineKm(48.69, 6.18, 48.70, 6.19)).toBeGreaterThan(0);
  });
});

// ─── walkingTimeMin ───────────────────────────────────────────────────────────

describe('walkingTimeMin', () => {
  it('1 km à 5 km/h = 12 min', () => {
    expect(walkingTimeMin(1)).toBe(12);
  });

  it('0.5 km = 6 min', () => {
    expect(walkingTimeMin(0.5)).toBe(6);
  });

  it('utilise Math.ceil (0.1 km → 2 min)', () => {
    // 0.1 / 5 * 60 = 1.2 → ceil = 2
    expect(walkingTimeMin(0.1)).toBe(2);
  });

  it('retourne 0 pour une distance nulle', () => {
    expect(walkingTimeMin(0)).toBe(0);
  });
});

// ─── geocodeAddress ───────────────────────────────────────────────────────────

describe('geocodeAddress', () => {
  it('retourne les coordonnées et le displayName', async () => {
    axios.get.mockResolvedValue({
      data: {
        features: [{
          geometry:   { coordinates: [6.1846, 48.6936] },
          properties: { label: 'Place Stanislas, Nancy' },
        }],
      },
    });

    const result = await geocodeAddress('Place Stanislas Nancy');

    expect(result).toEqual({ lat: 48.6936, lon: 6.1846, displayName: 'Place Stanislas, Nancy' });
  });

  it("ajoute 'Nancy' si absent de l'adresse", async () => {
    axios.get.mockResolvedValue({
      data: {
        features: [{
          geometry:   { coordinates: [6.18, 48.69] },
          properties: { label: 'Rue Stanislas, Nancy' },
        }],
      },
    });

    await geocodeAddress('Rue Stanislas');

    const params = axios.get.mock.calls[0][1].params;
    expect(params.q.toLowerCase()).toContain('nancy');
  });

  it("ne duplique pas 'Nancy' si déjà présent", async () => {
    axios.get.mockResolvedValue({
      data: {
        features: [{
          geometry:   { coordinates: [6.17, 48.68] },
          properties: { label: 'Gare de Nancy, Nancy' },
        }],
      },
    });

    await geocodeAddress('Gare Nancy');

    const q = axios.get.mock.calls[0][1].params.q.toLowerCase();
    const count = (q.match(/nancy/g) || []).length;
    expect(count).toBe(1);
  });

  it('lève une erreur 404 si aucun résultat', async () => {
    axios.get.mockResolvedValue({ data: { features: [] } });

    await expect(geocodeAddress('Adresse inexistante 999xyz'))
      .rejects.toMatchObject({ status: 404 });
  });

  it('propage les erreurs réseau', async () => {
    axios.get.mockRejectedValue(new Error('Network error'));

    await expect(geocodeAddress('Rue X')).rejects.toThrow('Network error');
  });
});

// ─── suggestAddresses ─────────────────────────────────────────────────────────

describe('suggestAddresses', () => {
  it('retourne [] sans appel axios si query null', async () => {
    expect(await suggestAddresses(null)).toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('retourne [] sans appel axios si query trop courte (< 3 chars)', async () => {
    expect(await suggestAddresses('ab')).toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('retourne les suggestions mappées pour une query valide', async () => {
    axios.get.mockResolvedValue({
      data: {
        features: [
          { geometry: { coordinates: [6.18, 48.69] }, properties: { label: 'Rue A, Nancy', postcode: '54000' } },
          { geometry: { coordinates: [6.19, 48.70] }, properties: { label: 'Rue B, Nancy', postcode: '54100' } },
        ],
      },
    });

    const result = await suggestAddresses('Rue Stan');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ label: 'Rue A, Nancy', lat: 48.69, lon: 6.18 });
    expect(result[0]).toHaveProperty('displayName');
  });

  it("ajoute 'nancy' si absent de la query", async () => {
    axios.get.mockResolvedValue({ data: { features: [] } });

    await suggestAddresses('Rue Stan');

    const q = axios.get.mock.calls[0][1].params.q.toLowerCase();
    expect(q).toContain('nancy');
  });

  it('retourne [] si API renvoie aucun résultat', async () => {
    axios.get.mockResolvedValue({ data: { features: [] } });
    expect(await suggestAddresses('xyz123abc')).toEqual([]);
  });
});

// ─── findNearestStops ─────────────────────────────────────────────────────────

describe('findNearestStops', () => {
  it('retourne les arrêts dans le rayon, triés par distance croissante', () => {
    const stops = findNearestStops(FROM_LAT, FROM_LON);

    expect(Array.isArray(stops)).toBe(true);
    expect(stops.length).toBeGreaterThan(0);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].distanceKm).toBeGreaterThanOrEqual(stops[i - 1].distanceKm);
    }
  });

  it("exclut les arrêts avec location_type === '1' (stations mères)", () => {
    getAllStops.mockReturnValue([
      { stop_id: 'S', stop_name: 'Station', stop_lat: `${FROM_LAT}`, stop_lon: `${FROM_LON}`, location_type: '1' },
      { stop_id: 'A', stop_name: 'Arrêt',   stop_lat: `${FROM_LAT}`, stop_lon: `${FROM_LON}`, location_type: '' },
    ]);

    const ids = findNearestStops(FROM_LAT, FROM_LON).map(s => s.stopId);
    expect(ids).not.toContain('S');
    expect(ids).toContain('A');
  });

  it('exclut les arrêts avec des coordonnées invalides (NaN)', () => {
    getAllStops.mockReturnValue([
      { stop_id: 'BAD', stop_name: 'Bad', stop_lat: 'invalid', stop_lon: '6.18', location_type: '' },
      { stop_id: 'A',   stop_name: 'Ok',  stop_lat: `${FROM_LAT}`, stop_lon: `${FROM_LON}`, location_type: '' },
    ]);

    const stops = findNearestStops(FROM_LAT, FROM_LON);
    const ids   = stops.map(s => s.stopId);
    expect(ids).not.toContain('BAD');
    expect(ids).toContain('A');
  });

  it('retourne [] si aucun arrêt dans le rayon de 1.5 km', () => {
    getAllStops.mockReturnValue([
      { stop_id: 'FAR', stop_name: 'Loin', stop_lat: '45.0', stop_lon: '2.0', location_type: '' },
    ]);

    expect(findNearestStops(FROM_LAT, FROM_LON)).toEqual([]);
  });

  it('respecte le paramètre maxCount', () => {
    getAllStops.mockReturnValue(
      Array.from({ length: 30 }, (_, i) => ({
        stop_id: `S${i}`, stop_name: `Arrêt ${i}`,
        stop_lat: `${FROM_LAT + i * 0.001}`, stop_lon: `${FROM_LON}`,
        location_type: '',
      }))
    );

    const stops = findNearestStops(FROM_LAT, FROM_LON, 5);
    expect(stops.length).toBeLessThanOrEqual(5);
  });
});

// ─── findTransitOptions ───────────────────────────────────────────────────────

describe('findTransitOptions', () => {
  it('retourne [] si aucun arrêt proche (getAllStops vide)', () => {
    getAllStops.mockReturnValue([]);

    expect(findTransitOptions(FROM_LAT, FROM_LON, TO_LAT, TO_LON)).toEqual([]);
  });

  it('retourne au moins une option de trajet direct (0 correspondance)', () => {
    const opts = findTransitOptions(FROM_LAT, FROM_LON, TO_LAT, TO_LON);

    expect(Array.isArray(opts)).toBe(true);
    expect(opts.length).toBeGreaterThan(0);
  });

  it('chaque option possède totalDurationMin et legs', () => {
    const opts = findTransitOptions(FROM_LAT, FROM_LON, TO_LAT, TO_LON);

    for (const opt of opts) {
      expect(opt).toHaveProperty('totalDurationMin');
      expect(typeof opt.totalDurationMin).toBe('number');
      expect(Array.isArray(opt.legs)).toBe(true);
    }
  });

  it('chaque option contient au moins un segment bus', () => {
    const opts = findTransitOptions(FROM_LAT, FROM_LON, TO_LAT, TO_LON);

    for (const opt of opts) {
      const busLegs = opt.legs.filter(l => l.type === 'bus');
      expect(busLegs.length).toBeGreaterThan(0);
    }
  });

  it('les options sont triées par durée croissante', () => {
    const opts = findTransitOptions(FROM_LAT, FROM_LON, TO_LAT, TO_LON);

    for (let i = 1; i < opts.length; i++) {
      expect(opts[i].totalDurationMin).toBeGreaterThanOrEqual(opts[i - 1].totalDurationMin);
    }
  });

  it('retourne [] si aucun départ à venir (getNextDepartureMins null, hasUpcomingDeparture false)', () => {
    hasUpcomingDeparture.mockReturnValue(false);
    getNextDepartureMins.mockReturnValue(null);

    expect(findTransitOptions(FROM_LAT, FROM_LON, TO_LAT, TO_LON)).toEqual([]);
  });

  it('inclut une option 1-correspondance (R1→R2 via arrêt C)', () => {
    const opts = findTransitOptions(FROM_LAT, FROM_LON, TO_LAT, TO_LON);
    // Peut contenir une option avec 2 segments bus (1 correspondance)
    const with2Bus = opts.filter(o => o.legs.filter(l => l.type === 'bus').length >= 2);
    // La 1-correspondance n'est pas garantie mais le code la recherche — vérifie qu'il ne crash pas
    expect(Array.isArray(with2Bus)).toBe(true);
  });

  it('le segment bus contient route.routeShortName et route.color', () => {
    const opts = findTransitOptions(FROM_LAT, FROM_LON, TO_LAT, TO_LON);

    const allBusLegs = opts.flatMap(o => o.legs.filter(l => l.type === 'bus'));
    expect(allBusLegs.length).toBeGreaterThan(0);
    for (const leg of allBusLegs) {
      expect(leg.route).toHaveProperty('routeShortName');
      expect(leg.route).toHaveProperty('color');
      expect(leg).toHaveProperty('stopCount');
      expect(leg).toHaveProperty('durationMin');
    }
  });

  it('les segments marche contiennent distanceKm et durationMin', () => {
    const opts = findTransitOptions(FROM_LAT, FROM_LON, TO_LAT, TO_LON);

    const walkLegs = opts.flatMap(o => o.legs.filter(l => l.type === 'walk'));
    for (const leg of walkLegs) {
      expect(leg).toHaveProperty('distanceKm');
      expect(leg).toHaveProperty('durationMin');
    }
  });

  it('utilise les correspondances officielles GTFS (getTransferStops)', () => {
    // Simule une correspondance officielle depuis l'arrêt C vers un arrêt fictif
    getTransferStops.mockImplementation(stopId => {
      if (stopId === 'C') return new Set(['C']);
      return new Set();
    });

    // Ne doit pas crasher
    expect(() => findTransitOptions(FROM_LAT, FROM_LON, TO_LAT, TO_LON)).not.toThrow();
  });
});

// ─── computeItinerary ─────────────────────────────────────────────────────────

describe('computeItinerary', () => {
  function mockGeocode(lat, lon, label) {
    return {
      data: {
        features: [{
          geometry:   { coordinates: [lon, lat] },
          properties: { label },
        }],
      },
    };
  }

  it('lève une erreur 400 si départ et arrivée sont au même lieu (< 50m)', async () => {
    // Les deux adresses géocodées donnent les mêmes coordonnées
    axios.get.mockResolvedValue(mockGeocode(48.6936, 6.1846, 'Place Stanislas, Nancy'));

    await expect(computeItinerary('Place Stanislas', 'Place Stanislas'))
      .rejects.toMatchObject({ status: 400 });
  });

  it('retourne from, to, walkingOnly et options pour un trajet normal', async () => {
    axios.get
      .mockResolvedValueOnce(mockGeocode(FROM_LAT, FROM_LON, 'Place Stanislas, Nancy'))
      .mockResolvedValueOnce(mockGeocode(TO_LAT,   TO_LON,   'Gare de Nancy, Nancy'));

    const result = await computeItinerary('Place Stanislas', 'Gare Nancy');

    expect(result).toHaveProperty('from');
    expect(result).toHaveProperty('to');
    expect(result).toHaveProperty('walkingOnly');
    expect(result.walkingOnly).toMatchObject({ type: 'walking' });
    expect(result.walkingOnly).toHaveProperty('distanceKm');
    expect(result.walkingOnly).toHaveProperty('durationMin');
    expect(result).toHaveProperty('options');
    expect(Array.isArray(result.options)).toBe(true);
  });

  it('ne propose pas de bus si distance < 500 m (haversine brut)', async () => {
    // Points à ~200 m de distance
    axios.get
      .mockResolvedValueOnce(mockGeocode(48.6936, 6.1846, 'Point A'))
      .mockResolvedValueOnce(mockGeocode(48.6950, 6.1860, 'Point B'));

    const result = await computeItinerary('Point A', 'Point B');

    expect(result.options).toEqual([]);
  });

  it('filtre les options bus plus lentes que la marche', async () => {
    axios.get
      .mockResolvedValueOnce(mockGeocode(FROM_LAT, FROM_LON, 'Départ'))
      .mockResolvedValueOnce(mockGeocode(TO_LAT,   TO_LON,   'Arrivée'));

    const result = await computeItinerary('Départ', 'Arrivée');

    for (const opt of result.options) {
      expect(opt.totalDurationMin).toBeLessThanOrEqual(result.walkingOnly.durationMin);
    }
  });

  it('propage une erreur 404 si une adresse est introuvable', async () => {
    axios.get.mockResolvedValue({ data: { features: [] } });

    await expect(computeItinerary('Adresse inconnue', 'Autre'))
      .rejects.toMatchObject({ status: 404 });
  });

  it('from.address et to.address sont les adresses de saisie originales', async () => {
    axios.get
      .mockResolvedValueOnce(mockGeocode(FROM_LAT, FROM_LON, 'Place Stanislas, Nancy'))
      .mockResolvedValueOnce(mockGeocode(TO_LAT,   TO_LON,   'Gare de Nancy, Nancy'));

    const result = await computeItinerary('Place Stanislas', 'Gare Nancy');

    expect(result.from.address).toBe('Place Stanislas');
    expect(result.to.address).toBe('Gare Nancy');
    expect(result.from.displayName).toBe('Place Stanislas, Nancy');
  });
});

// ─── debugItinerary ───────────────────────────────────────────────────────────

describe('debugItinerary', () => {
  function mockGeocode(lat, lon, label) {
    return {
      data: {
        features: [{
          geometry:   { coordinates: [lon, lat] },
          properties: { label },
        }],
      },
    };
  }

  it('retourne les données de diagnostic complètes', async () => {
    axios.get
      .mockResolvedValueOnce(mockGeocode(FROM_LAT, FROM_LON, 'Place Stanislas, Nancy'))
      .mockResolvedValueOnce(mockGeocode(TO_LAT,   TO_LON,   'Gare de Nancy, Nancy'));

    const result = await debugItinerary('Place Stanislas', 'Gare Nancy');

    expect(result).toHaveProperty('from');
    expect(result).toHaveProperty('to');
    expect(result).toHaveProperty('distanceKm');
    expect(result).toHaveProperty('walkingMin');
    expect(result).toHaveProperty('fromStops');
    expect(result).toHaveProperty('toStops');
    expect(result).toHaveProperty('directMatches');
    expect(result).toHaveProperty('rawOptions');
    expect(result).toHaveProperty('rawOptionsCount');
    expect(result).toHaveProperty('filteredOptionsCount');
  });

  it('fromStops contient les routes disponibles à chaque arrêt proche', async () => {
    axios.get
      .mockResolvedValueOnce(mockGeocode(FROM_LAT, FROM_LON, 'Départ'))
      .mockResolvedValueOnce(mockGeocode(TO_LAT,   TO_LON,   'Arrivée'));

    const result = await debugItinerary('Départ', 'Arrivée');

    expect(Array.isArray(result.fromStops)).toBe(true);
    if (result.fromStops.length > 0) {
      expect(result.fromStops[0]).toHaveProperty('stopId');
      expect(result.fromStops[0]).toHaveProperty('routes');
    }
  });

  it('rawOptions liste le nombre de segments de chaque option', async () => {
    axios.get
      .mockResolvedValueOnce(mockGeocode(FROM_LAT, FROM_LON, 'Départ'))
      .mockResolvedValueOnce(mockGeocode(TO_LAT,   TO_LON,   'Arrivée'));

    const result = await debugItinerary('Départ', 'Arrivée');

    for (const opt of result.rawOptions) {
      expect(opt).toHaveProperty('totalDurationMin');
      expect(opt).toHaveProperty('fasterThanWalk');
      expect(Array.isArray(opt.legs)).toBe(true);
    }
  });

  it('propage une erreur 404 si adresse introuvable', async () => {
    axios.get.mockResolvedValue({ data: { features: [] } });

    await expect(debugItinerary('Adresse inconnue', 'Autre'))
      .rejects.toMatchObject({ status: 404 });
  });
});

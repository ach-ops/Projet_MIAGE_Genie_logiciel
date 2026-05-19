/**
 * Tests complémentaires du service GTFS statique.
 *
 * Couvre les fonctions non testées dans gtfs.service.test.js :
 * - getDirectionName  : nom de destination (trip_headsign) pour une direction
 * - getRouteShape     : liste des coordonnées d'un tracé
 * - getAllTerminals    : liste des terminaux (dernier arrêt par route+direction)
 *
 * Utilise les mêmes fixtures que gtfs.service.test.js.
 * Données de référence :
 *   TRIP_1A : ROUTE_1 dir 0, headsign=Terminus Nord, shape=SHAPE_1, stops A→B→C
 *   TRIP_1C : ROUTE_1 dir 1, headsign=Terminus Sud,  stops C→B→A
 *   TRIP_2A : ROUTE_2 dir 0, headsign=Terminus Est,  stops A→B
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadGTFS,
  resetGTFSForTesting,
  getDirectionName,
  getRouteShape,
  getAllTerminals,
  getActiveServiceIds,
  hasUpcomingDeparture,
  getTransferStops,
  debugStop,
} from '../../services/gtfs.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, '../fixtures/gtfs');

beforeAll(async () => {
  await loadGTFS(FIXTURE_DIR);
});

afterAll(() => {
  resetGTFSForTesting();
});

// ─── getDirectionName ─────────────────────────────────────────────────────────

describe('getDirectionName', () => {
  it('retourne le trip_headsign de la direction 0 pour ROUTE_1 depuis STOP_A', () => {
    const name = getDirectionName('STOP_A', 'ROUTE_1', 0);
    expect(name).toBe('Terminus Nord');
  });

  it('retourne le trip_headsign de la direction 1 pour ROUTE_1 depuis STOP_A', () => {
    // TRIP_1C passe par STOP_A (séquence 3) direction 1
    const name = getDirectionName('STOP_A', 'ROUTE_1', 1);
    expect(name).toBe('Terminus Sud');
  });

  it('retourne null si aucun trip de cette route+direction ne passe par le stop', () => {
    expect(getDirectionName('STOP_A', 'ROUTE_INEXISTANTE', 0)).toBeNull();
  });

  it('retourne null pour un stop inconnu', () => {
    expect(getDirectionName('STOP_INCONNU', 'ROUTE_1', 0)).toBeNull();
  });

  it('compare directionId en tant que string (insensible au type)', () => {
    // directionId peut être passé comme nombre ou string
    expect(getDirectionName('STOP_A', 'ROUTE_1', '0')).toBe('Terminus Nord');
  });
});

// ─── getRouteShape ────────────────────────────────────────────────────────────

describe('getRouteShape', () => {
  it('retourne les coordonnées [lat, lon] du tracé SHAPE_1 pour ROUTE_1 dir 0', () => {
    const shape = getRouteShape('ROUTE_1', 0);

    expect(shape).not.toHaveLength(0);
    expect(shape[0]).toHaveLength(2); // [lat, lon]
    expect(typeof shape[0][0]).toBe('number');
    expect(typeof shape[0][1]).toBe('number');
  });

  it('retourne les points dans l\'ordre de la fixture (seq 1→2→3)', () => {
    const shape = getRouteShape('ROUTE_1', 0);

    expect(shape).toHaveLength(3);
    expect(shape[0][0]).toBeCloseTo(48.6921, 3);
    expect(shape[0][1]).toBeCloseTo(6.1844, 3);
  });

  it('retourne [] pour une route sans shape_id (ROUTE_1 dir 1)', () => {
    // TRIP_1C a un shape_id vide dans les fixtures
    const shape = getRouteShape('ROUTE_1', 1);
    expect(shape).toEqual([]);
  });

  it('retourne [] pour une route inexistante', () => {
    expect(getRouteShape('ROUTE_INEXISTANTE', 0)).toEqual([]);
  });

  it('retourne [] si aucun trip ne correspond à la direction', () => {
    expect(getRouteShape('ROUTE_1', 99)).toEqual([]);
  });
});

// ─── getAllTerminals ──────────────────────────────────────────────────────────

describe('getAllTerminals', () => {
  it('retourne une liste non vide de terminaux', () => {
    const terminals = getAllTerminals();
    expect(terminals.length).toBeGreaterThan(0);
  });

  it('chaque terminal a les champs stopId, routeId, directionId, name', () => {
    const terminals = getAllTerminals();
    for (const t of terminals) {
      expect(t).toHaveProperty('stopId');
      expect(t).toHaveProperty('routeId');
      expect(t).toHaveProperty('directionId');
      expect(t).toHaveProperty('name');
    }
  });

  it('ne retourne qu\'un seul terminal par combinaison route+direction', () => {
    const terminals = getAllTerminals();
    const keys = terminals.map(t => `${t.routeId}-${t.directionId}`);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('identifie STOP_C comme terminal de ROUTE_1 direction 0 (dernier arrêt TRIP_1A)', () => {
    const terminals = getAllTerminals();
    const t = terminals.find(t => t.routeId === 'ROUTE_1' && String(t.directionId) === '0');
    expect(t).toBeDefined();
    expect(t.stopId).toBe('STOP_C');
  });

  it('identifie STOP_A comme terminal de ROUTE_1 direction 1 (dernier arrêt TRIP_1C)', () => {
    const terminals = getAllTerminals();
    const t = terminals.find(t => t.routeId === 'ROUTE_1' && String(t.directionId) === '1');
    expect(t).toBeDefined();
    expect(t.stopId).toBe('STOP_A');
  });

  it('identifie STOP_B comme terminal de ROUTE_2 direction 0 (dernier arrêt TRIP_2A)', () => {
    const terminals = getAllTerminals();
    const t = terminals.find(t => t.routeId === 'ROUTE_2' && String(t.directionId) === '0');
    expect(t).toBeDefined();
    expect(t.stopId).toBe('STOP_B');
  });

  it('ne crée pas de doublons pour les trips inactifs (SERVICE_INACTIVE)', () => {
    // TRIP_INACTIVE est ROUTE_1 dir 0, même clé que TRIP_1A → doit être ignoré (déjà vu)
    const terminals = getAllTerminals();
    const route1dir0 = terminals.filter(
      t => t.routeId === 'ROUTE_1' && String(t.directionId) === '0'
    );
    expect(route1dir0).toHaveLength(1);
  });

  it('le name du terminal est le stop_name de l\'arrêt', () => {
    const terminals = getAllTerminals();
    const t = terminals.find(t => t.stopId === 'STOP_C');
    expect(t.name).toBe('Arrêt C');
  });
});

// ─── getActiveServiceIds — cache hit ─────────────────────────────────────────

const REF_DATE  = new Date(2026, 3, 6, 6, 0, 0);
const LATE_DATE = new Date(2026, 3, 6, 23, 0, 0);

describe('getActiveServiceIds — cache', () => {
  it('retourne la même référence au 2e appel avec la même date (cache hit)', () => {
    const r1 = getActiveServiceIds(REF_DATE);
    const r2 = getActiveServiceIds(REF_DATE);
    expect(r2).toBe(r1);
  });

  it('applique exception_type=1 (ajout) pour le 7 avril 2026', () => {
    // calendar_dates.txt : SERVICE_INACTIVE ajouté le 07/04/2026
    const date = new Date(2026, 3, 7, 6, 0, 0);
    const active = getActiveServiceIds(date);
    expect(active.has('SERVICE_INACTIVE')).toBe(true);
  });

  it('applique exception_type=2 (suppression) pour le 7 avril 2026', () => {
    // calendar_dates.txt : SERVICE_ALL supprimé le 07/04/2026
    const date = new Date(2026, 3, 7, 6, 0, 0);
    const active = getActiveServiceIds(date);
    expect(active.has('SERVICE_ALL')).toBe(false);
  });
});

describe('getTransferStops — avec transfers.txt', () => {
  it('retourne les arrêts en correspondance avec STOP_A', () => {
    const result = getTransferStops('STOP_A');
    expect(result).toBeInstanceOf(Set);
    expect(result.has('STOP_B')).toBe(true);
  });

  it('ignore la correspondance STOP_A → STOP_A (from === to)', () => {
    const result = getTransferStops('STOP_A');
    expect(result.has('STOP_A')).toBe(false);
  });

  it('retourne les correspondances dans les deux sens', () => {
    const fromB = getTransferStops('STOP_B');
    expect(fromB.has('STOP_A')).toBe(true);
  });
});

// ─── hasUpcomingDeparture ─────────────────────────────────────────────────────

describe('hasUpcomingDeparture', () => {
  it('retourne true quand un départ futur existe', () => {
    expect(hasUpcomingDeparture('STOP_A', 'ROUTE_1', 0, REF_DATE)).toBe(true);
  });

  it('retourne true avec directionId en string', () => {
    expect(hasUpcomingDeparture('STOP_A', 'ROUTE_1', '0', REF_DATE)).toBe(true);
  });

  it('retourne false quand tous les départs sont passés', () => {
    expect(hasUpcomingDeparture('STOP_A', 'ROUTE_1', 0, LATE_DATE)).toBe(false);
  });

  it('retourne false pour une direction inexistante', () => {
    expect(hasUpcomingDeparture('STOP_A', 'ROUTE_1', 99, REF_DATE)).toBe(false);
  });

  it('retourne false pour un stop inconnu', () => {
    expect(hasUpcomingDeparture('STOP_INCONNU', 'ROUTE_1', 0, REF_DATE)).toBe(false);
  });

  it('retourne false si la route ne correspond pas', () => {
    expect(hasUpcomingDeparture('STOP_A', 'ROUTE_INEXISTANTE', 0, REF_DATE)).toBe(false);
  });
});

// ─── getTransferStops ─────────────────────────────────────────────────────────

describe('getTransferStops', () => {
  it('retourne un Set vide pour un stop inconnu', () => {
    expect(getTransferStops('STOP_INCONNU').size).toBe(0);
  });

  it('gère un stopId undefined sans erreur', () => {
    expect(getTransferStops(undefined)).toBeInstanceOf(Set);
  });
});

// ─── debugStop ────────────────────────────────────────────────────────────────

describe('debugStop', () => {
  it('retourne exists: false pour un stop inconnu', () => {
    expect(debugStop('STOP_INCONNU')).toEqual({ exists: false, stopId: 'STOP_INCONNU' });
  });

  it('retourne les informations complètes pour STOP_A', () => {
    const result = debugStop('STOP_A');
    expect(result.exists).toBe(true);
    expect(result.stopId).toBe('STOP_A');
    expect(result.stopName).toBe('Arrêt A');
    expect(result.totalStopTimes).toBeGreaterThan(0);
    expect(Array.isArray(result.routes)).toBe(true);
  });

  it('inclut les routes desservant STOP_A', () => {
    const result = debugStop('STOP_A');
    expect(result.routes.map(r => r.routeId)).toContain('ROUTE_1');
  });

  it('inclut activeServiceCount, today et nextPassageInMin', () => {
    const result = debugStop('STOP_A');
    expect(typeof result.activeServiceCount).toBe('number');
    expect(result.today).toMatch(/^\d{8}$/);
    for (const route of result.routes) {
      expect(route).toHaveProperty('nextPassageInMin');
    }
  });
});

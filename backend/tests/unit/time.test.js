import { describe, it, expect } from 'vitest';
import {
  formatDateYYYYMMDD,
  getWeekdayColumn,
  gtfsTimeToTimestamp,
  longToNumber,
} from '../../utils/time.js';

// ─── formatDateYYYYMMDD ────────────────────────────────────────────────────────

describe(`formatDateYYYYMMDD`, () => {
  it(`formate correctement une date standard`, () => {
    const date = new Date(2026, 3, 6, 10, 0, 0); // 6 avril 2026
    expect(formatDateYYYYMMDD(date)).toBe('20260406');
  });

  it(`pad les mois et jours avec un zéro si nécessaire`, () => {
    const date = new Date(2026, 0, 9); // 9 janvier 2026
    expect(formatDateYYYYMMDD(date)).toBe('20260109');
  });

  it(`utilise la date courante par défaut sans crash`, () => {
    const result = formatDateYYYYMMDD();
    expect(result).toMatch(/^\d{8}$/);
  });
});

// ─── getWeekdayColumn ─────────────────────────────────────────────────────────

describe(`getWeekdayColumn`, () => {
  it(`retourne monday pour un lundi`, () => {
    const monday = new Date(2026, 3, 6); // 6 avril 2026 = lundi
    expect(getWeekdayColumn(monday)).toBe('monday');
  });

  it(`retourne sunday pour un dimanche`, () => {
    const sunday = new Date(2026, 3, 5); // 5 avril 2026 = dimanche
    expect(getWeekdayColumn(sunday)).toBe('sunday');
  });

  it(`retourne saturday pour un samedi`, () => {
    const saturday = new Date(2026, 3, 4); // 4 avril 2026 = samedi
    expect(getWeekdayColumn(saturday)).toBe('saturday');
  });

  it(`retourne friday pour un vendredi`, () => {
    const friday = new Date(2026, 3, 3); // 3 avril 2026 = vendredi
    expect(getWeekdayColumn(friday)).toBe('friday');
  });
});

// ─── gtfsTimeToTimestamp ──────────────────────────────────────────────────────

describe(`gtfsTimeToTimestamp`, () => {
  const REF = new Date(2026, 3, 6, 6, 0, 0);

  it(`convertit une heure GTFS standard`, () => {
    const ts = gtfsTimeToTimestamp('07:00:00', REF);
    expect(ts).toBeGreaterThan(REF.getTime());
    expect(ts).toBe(new Date(2026, 3, 6, 7, 0, 0).getTime());
  });

  it(`gère une heure > 24 (service nocturne le lendemain)`, () => {
    const ts24 = gtfsTimeToTimestamp('24:30:00', REF);
    const expected = new Date(2026, 3, 7, 0, 30, 0).getTime();
    expect(ts24).toBe(expected);
  });

  it(`gère 25:00:00 (1h00 le surlendemain)`, () => {
    const ts25 = gtfsTimeToTimestamp('25:00:00', REF);
    const expected = new Date(2026, 3, 7, 1, 0, 0).getTime();
    expect(ts25).toBe(expected);
  });

  it(`retourne null pour un format invalide`, () => {
    expect(gtfsTimeToTimestamp('invalid', REF)).toBeNull();
    expect(gtfsTimeToTimestamp('', REF)).toBeNull();
    expect(gtfsTimeToTimestamp(null, REF)).toBeNull();
    expect(gtfsTimeToTimestamp(undefined, REF)).toBeNull();
  });

  it(`retourne null si les parties sont NaN`, () => {
    expect(gtfsTimeToTimestamp('aa:bb:cc', REF)).toBeNull();
  });

  it(`accepte HH:MM sans secondes`, () => {
    const ts = gtfsTimeToTimestamp('08:30', REF);
    expect(ts).toBe(new Date(2026, 3, 6, 8, 30, 0).getTime());
  });

  it(`produit des timestamps croissants pour des heures croissantes`, () => {
    const ts1 = gtfsTimeToTimestamp('07:00:00', REF);
    const ts2 = gtfsTimeToTimestamp('08:00:00', REF);
    const ts3 = gtfsTimeToTimestamp('24:00:00', REF);
    expect(ts1).toBeLessThan(ts2);
    expect(ts2).toBeLessThan(ts3);
  });
});

// ─── longToNumber ─────────────────────────────────────────────────────────────

describe(`longToNumber`, () => {
  it("retourne un nombre directement si c'est déjà un number", () => {
    expect(longToNumber(1744000000)).toBe(1744000000);
  });

  it(`utilise .toNumber() si disponible (objet Long protobuf)`, () => {
    const longObj = { toNumber: () => 1744000000, low: -123, high: 0 };
    expect(longToNumber(longObj)).toBe(1744000000);
  });

  it(`calcule manuellement depuis low/high si toNumber absent`, () => {
    const longObj = { low: 1744000000, high: 0 };
    expect(longToNumber(longObj)).toBe(1744000000);
  });

  it(`gère correctement un high non nul`, () => {
    const longObj = { low: 100, high: 1 };
    expect(longToNumber(longObj)).toBe(4294967396);
  });

  it(`retourne 0 pour null`, () => {
    expect(longToNumber(null)).toBe(0);
  });

  it(`retourne 0 pour undefined`, () => {
    expect(longToNumber(undefined)).toBe(0);
  });

});

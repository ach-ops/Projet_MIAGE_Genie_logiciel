/**
 * Utilitaires de gestion des temps GTFS.
 *
 * GTFS permet des heures > 24:00 pour les services nocturnes qui débordent sur le
 * lendemain (ex : 25:30:00 = 01:30 le lendemain). Ces heures ne sont PAS invalides.
 */

const DEFAULT_TIME_ZONE = process.env.TZ || 'Europe/Paris';

function extractParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const byType = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
  };
}

function parseShortOffset(offsetLabel) {
  const m = offsetLabel.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  const hours = Number(m[2]);
  const minutes = Number(m[3] || '0');
  return sign * (hours * 60 + minutes) * 60000;
}

function getTimeZoneOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  });
  const tzPart = dtf.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value || 'GMT+0';
  return parseShortOffset(tzPart);
}

function zonedDateTimeToTimestamp({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone) {
  // Première passe : on suppose que l'offset UTC actuel est correct
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset1 = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const ts1 = utcGuess - offset1;
  // Deuxième passe pour corriger les changements d'heure (heure d'été/hiver)
  const offset2 = getTimeZoneOffsetMs(new Date(ts1), timeZone);
  return offset1 === offset2 ? ts1 : utcGuess - offset2;
}

/**
 * Formate une Date en YYYYMMDD en heure locale
 */
export function formatDateYYYYMMDD(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const { year, month, day } = extractParts(date, timeZone);
  const y = year;
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Retourne le nom de la colonne GTFS correspondant au jour de la semaine.
 */
export function getWeekdayColumn(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
  }).format(date).toLowerCase();
}

/**
 * Convertit une heure GTFS "HH:MM:SS" en timestamp
 * en prenant comme référence le jour local du fuseau applicatif.
 *
 * @returns {number|null} timestamp en ms, ou null si format invalide
 */
export function gtfsTimeToTimestamp(gtfsTime, referenceDate = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  if (!gtfsTime) return null;

  const parts = gtfsTime.split(':').map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return null;

  const [h, m, s = 0] = parts;
  const { year, month, day } = extractParts(referenceDate, timeZone);

  return zonedDateTimeToTimestamp({ year, month, day, hour: h, minute: m, second: s }, timeZone);
}

export function formatTimestampToLocalTime(timestampMs, {
  locale = 'fr-FR',
  timeZone = DEFAULT_TIME_ZONE,
  withSeconds = false,
} = {}) {
  if (!Number.isFinite(timestampMs)) return null;
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false,
  }).format(new Date(timestampMs));
}

/**
 * Convertit une valeur de timestamp.
 * gtfs-realtime-bindings représente int64 via un objet Long de protobufjs.
 *
 * @returns {number}
 */
export function longToNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  if (typeof value === 'object' && 'low' in value && 'high' in value) {
    // Calcul manuel si .toNumber() absent : 4294967296 = 2^32 (décalage du mot de poids fort)
    return value.low + value.high * 4294967296;
  }
  return Number(value);
}

// Seuls ces caractères sont attendus dans les IDs GTFS (pas d'injection SQL)
const GTFS_ID_RE = /^[A-Za-z0-9_\-.:]+$/;

// Valide et retourne un identifiant GTFS (stopId, routeId, directionId…), null si invalide.
function sanitizeId(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > 100 || !GTFS_ID_RE.test(v)) return null;
  return v;
}

// Middleware Express : rejette avec 400 si les params de route contiennent des IDs GTFS invalides.
export function validateGtfsParams(...paramNames) {
  return (req, res, next) => {
    for (const name of paramNames) {
      const clean = sanitizeId(req.params[name]);
      if (!clean) {
        return res.status(400).json({ error: `Paramètre invalide : "${name}".` });
      }
      // On réécrit le param avec la valeur nettoyée (trim) pour les services en aval
      req.params[name] = clean;
    }
    next();
  };
}

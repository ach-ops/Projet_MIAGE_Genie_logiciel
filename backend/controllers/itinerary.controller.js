/**
 * Contrôleur Itinéraire.
 * Gère les requêtes de calcul d'itinéraire multimodal et d'autocomplétion d'adresses.
 */
import { computeItinerary, suggestAddresses } from '../services/itinerary.service.js';
import { logger } from '../utils/logger.js';

// Nettoie et valide une valeur texte reçue en query param.
// Retourne null si la valeur est vide.
function sanitize(value, maxLen = 200) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > maxLen || /[<>"'`{}\\]/.test(v)) return null;
  return v;
}

/**
 * GET /api/itinerary/suggest?q=<saisie>
 * Retourne jusqu'à 6 suggestions d'adresses pour l'autocomplétion du champ de recherche.
 */
export async function getSuggestions(req, res) {
  const q = sanitize(req.query.q, 150);
  // Si la saisie est trop courte ou invalide, on retourne une liste vide sans appeler l'API
  if (!q || q.length < 2) return res.json([]);

  try {
    res.json(await suggestAddresses(q));
  } catch (err) {
    logger.error('Erreur suggestions adresses', { message: err.message });
    res.json([]);
  }
}

/**
 * GET /api/itinerary?from=<adresse>&to=<adresse>
 * Calcule un itinéraire multimodal (marche + bus) entre deux adresses de Nancy.
 * Retourne l'option "tout à pied" et jusqu'à 5 options bus avec les segments détaillés.
 */
export async function getItinerary(req, res) {
  const from = sanitize(req.query.from);
  const to   = sanitize(req.query.to);

  // Les deux paramètres sont obligatoires
  if (!from || !to) {
    return res.status(400).json({ error: 'Les paramètres "from" et "to" sont obligatoires.' });
  }

  try {
    res.json(await computeItinerary(from, to));
  } catch (err) {
    logger.error('Erreur calcul itinéraire', { message: err.message });
    res.status(err.status || 500).json({ error: err.message });
  }
}

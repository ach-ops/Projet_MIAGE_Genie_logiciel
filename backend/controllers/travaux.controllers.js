/**
 * Contrôleur Travaux / Incidents.
 * Retourne les incidents trafic en temps réel sur l'agglomération de Nancy.
 */
import { fetchIncidents } from '../services/travaux.service.js';

// GET /api/travaux/incidents
// Retourne les accidents, chantiers et routes barrées
export async function listIncidents(_req, res) {
  const data = await fetchIncidents();
  res.json(data);
}

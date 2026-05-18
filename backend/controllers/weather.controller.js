/**
 * Contrôleur Météo.
 * Retourne la météo actuelle et les prévisions pour Nancy.
 */
import weatherService from '../services/weather.service.js';

// GET /api/weather
// Retourne la météo actuelle + prévisions heure par heure sur 2 jours
export async function getWeather(_req, res) {
  const data = await weatherService.getWeather();
  res.json(data);
}

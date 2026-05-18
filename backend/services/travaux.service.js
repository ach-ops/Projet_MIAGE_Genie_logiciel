/**
 * Service des incidents et travaux — Agglomération de Nancy.
 *
 * Récupère les incidents trafic en temps réel sur les routes de l'agglomération.
 */
import axios from 'axios';
import { config } from '../config/index.js';

// URL du flux d'incidents
const INCIDENTS_URL = 'https://carto.g-ny.org/data/cifs/cifs_waze_v2.json';

/**
 * Retourne tous les incidents trafic actifs de l'agglomération de Nancy.
 */
export async function fetchIncidents() {
  const { data } = await axios.get(INCIDENTS_URL, { timeout: config.axiosTimeoutMs });
  return data;
}

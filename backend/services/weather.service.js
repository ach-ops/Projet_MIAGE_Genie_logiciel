/**
 * Service météo — Nancy.
 *
 * Appelle l'API WeatherAPI.com pour récupérer la météo actuelle
 * et les prévisions heure par heure sur 2 jours.
 *
 */
import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const CITY = 'Nancy';

// Cache en mémoire avec une durée de vie de 3 heures.
let _cache       = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

async function getWeather() {
  const now = Date.now();

  // Si le cache est encore valide, on retourne directement les données stockées
  if (_cache && now < _cacheExpiry) {
    return _cache;
  }

  // On relit la clé API à chaque appel
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    throw new Error("Variable d'environnement WEATHER_API_KEY manquante");
  }

  const url = 'https://api.weatherapi.com/v1/forecast.json';

  let data;
  try {
    const response = await axios.get(url, {
      params: { key: apiKey, q: CITY, lang: 'fr', days: 2, hourly: 24 },
      timeout: config.axiosTimeoutMs,
    });
    data = response.data;
  } catch (err) {
    const status = err.response?.status;
    const detail = status ? `HTTP ${status}` : err.message;
    logger.error('Erreur appel WeatherAPI', { detail });
    throw new Error(`Impossible de récupérer la météo : ${detail}`);
  }

  // On ne garde que les champs utiles pour le frontend
  const result = {
    current: {
      temp_c:    data.current.temp_c,        // température actuelle en °C
      condition: {
        text: data.current.condition.text,   // description 
        icon: data.current.condition.icon,   // URL de l'icône météo
      },
      wind_kph:  data.current.wind_kph,      // vitesse du vent en km/h
      humidity:  data.current.humidity,      // humidité en %
    },
    forecast: {
      // Prévisions heure par heure sur 2 jours
      forecastday: data.forecast.forecastday.map(day => ({
        hour: day.hour.map(h => ({
          time:      h.time,
          temp_c:    h.temp_c,
          condition: {
            text: h.condition.text,
            icon: h.condition.icon,
          },
        })),
      })),
    },
  };

  // Mise en cache du résultat pour 3 heures
  _cache       = result;
  _cacheExpiry = now + CACHE_TTL_MS;

  return result;
}

export function _resetWeatherCache() {
  _cache       = null;
  _cacheExpiry = 0;
}

export default { getWeather };

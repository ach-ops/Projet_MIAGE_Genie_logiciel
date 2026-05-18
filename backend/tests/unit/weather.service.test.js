/**
 * Tests du service météo.
 *
 * On teste :
 * - API key manquante → erreur explicite
 * - Réponse HTTP non-ok → erreur avec statut
 * - Réponse valide → structure de données réduite correcte
 * - Erreur réseau → propagation de l'erreur
 * - Cache en mémoire → second appel sans axios.get
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');

import weatherService, { _resetWeatherCache } from '../../services/weather.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWeatherApiResponse() {
  return {
    current: {
      temp_c: 12.5,
      condition: { text: 'Ensoleillé', icon: '//cdn.weatherapi.com/weather/64x64/day/113.png' },
      wind_kph: 15,
      humidity: 60,
    },
    forecast: {
      forecastday: [
        {
          hour: [
            { time: '2026-04-12 00:00', temp_c: 10, condition: { text: 'Clair', icon: '//cdn/night/113.png' } },
            { time: '2026-04-12 01:00', temp_c: 9,  condition: { text: 'Clair', icon: '//cdn/night/113.png' } },
          ],
        },
        {
          hour: [
            { time: '2026-04-13 00:00', temp_c: 11, condition: { text: 'Nuageux', icon: '//cdn/day/116.png' } },
          ],
        },
      ],
    },
  };
}

const ORIGINAL_KEY = process.env.WEATHER_API_KEY;

beforeEach(() => {
  process.env.WEATHER_API_KEY = 'TEST_KEY_123';
  _resetWeatherCache(); // vide le cache entre chaque test
});

afterEach(() => {
  process.env.WEATHER_API_KEY = ORIGINAL_KEY;
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('weatherService.getWeather', () => {

  it('retourne la structure réduite correcte (current + forecast)', async () => {
    axios.get.mockResolvedValue({ data: makeWeatherApiResponse() });

    const result = await weatherService.getWeather();

    expect(result.current).toEqual({
      temp_c: 12.5,
      condition: { text: 'Ensoleillé', icon: '//cdn.weatherapi.com/weather/64x64/day/113.png' },
      wind_kph: 15,
      humidity: 60,
    });

    expect(result.forecast.forecastday).toHaveLength(2);
    expect(result.forecast.forecastday[0].hour[0]).toEqual({
      time: '2026-04-12 00:00',
      temp_c: 10,
      condition: { text: 'Clair', icon: '//cdn/night/113.png' },
    });
  });

  it('la réponse ne contient que les champs attendus (pas de raw API data)', async () => {
    axios.get.mockResolvedValue({ data: makeWeatherApiResponse() });

    const result = await weatherService.getWeather();

    expect(Object.keys(result.current)).toEqual(['temp_c', 'condition', 'wind_kph', 'humidity']);
    const hour = result.forecast.forecastday[0].hour[0];
    expect(Object.keys(hour)).toEqual(['time', 'temp_c', 'condition']);
  });

  it('appelle axios.get avec la bonne URL et les bons params', async () => {
    axios.get.mockResolvedValue({ data: makeWeatherApiResponse() });
    process.env.WEATHER_API_KEY = 'MY_KEY';

    await weatherService.getWeather();

    expect(axios.get).toHaveBeenCalledTimes(1);
    const [url, options] = axios.get.mock.calls[0];
    expect(url).toContain('weatherapi.com');
    expect(options.params).toMatchObject({ key: 'MY_KEY', q: 'Nancy', days: 2 });
  });

  it('lève une erreur si WEATHER_API_KEY est absente', async () => {
    delete process.env.WEATHER_API_KEY;

    await expect(weatherService.getWeather()).rejects.toThrow('WEATHER_API_KEY');
  });

  it('lève une erreur si axios renvoie une erreur HTTP 404', async () => {
    const err = new Error('Not Found');
    err.response = { status: 404 };
    axios.get.mockRejectedValue(err);

    await expect(weatherService.getWeather()).rejects.toThrow('404');
  });

  it('lève une erreur si axios renvoie une erreur HTTP 500', async () => {
    const err = new Error('Internal Server Error');
    err.response = { status: 500 };
    axios.get.mockRejectedValue(err);

    await expect(weatherService.getWeather()).rejects.toThrow('500');
  });

  it('propage le message si axios rejette (erreur réseau)', async () => {
    axios.get.mockRejectedValue(new Error('Network error'));

    await expect(weatherService.getWeather()).rejects.toThrow('Network error');
  });

  it('gère plusieurs jours de prévision', async () => {
    axios.get.mockResolvedValue({ data: makeWeatherApiResponse() });

    const result = await weatherService.getWeather();

    expect(result.forecast.forecastday).toHaveLength(2);
    expect(result.forecast.forecastday[1].hour[0].temp_c).toBe(11);
  });

  it('utilise le cache au second appel sans appeler axios.get de nouveau', async () => {
    axios.get.mockResolvedValue({ data: makeWeatherApiResponse() });

    const first  = await weatherService.getWeather();
    const second = await weatherService.getWeather();

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});

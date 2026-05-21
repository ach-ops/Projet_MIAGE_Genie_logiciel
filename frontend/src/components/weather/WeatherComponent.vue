<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertCircle, MapPin, Wind, Droplets } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { API_BASE } from '@/config/api'

const { theme } = useTheme()

interface WeatherData {
  current: {
    temp_c: number
    condition: { text: string; icon: string }
    wind_kph: number
    humidity: number
  }
  forecast: {
    forecastday: Array<{
      hour: Array<{
        time: string
        temp_c: number
        condition: { text: string; icon: string }
      }>
    }>
  }
}

const currentWeather = ref<WeatherData['current'] | null>(null)
const hourlyForecast = ref<WeatherData['forecast']['forecastday'][0]['hour']>([])
const nextDayForecast = ref<WeatherData['forecast']['forecastday'][0]['hour']>([])
const loading = ref(true)
const error = ref('')

// Fusionne aujourd'hui + demain pour avoir les prochaines heures même en fin de journée
const upcomingHours = computed(() => {
  const now = new Date()
  const allHours = hourlyForecast.value.concat(nextDayForecast.value)
  return allHours.filter((h) => new Date(h.time) >= now).slice(0, 10)
})

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE}/api/weather`)
    if (!res.ok) throw new Error('Erreur API météo')
    const data: WeatherData = await res.json()
    currentWeather.value = data.current
    // forecastday[0] = aujourd'hui, forecastday[1] = demain (pour upcomingHours en fin de soirée)
    hourlyForecast.value = data.forecast.forecastday[0]?.hour ?? []
    nextDayForecast.value = data.forecast.forecastday[1]?.hour ?? []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erreur météo'
  } finally {
    loading.value = false
  }
})

// WeatherAPI renvoie le format "2026-04-19 14:00" → on extrait "14:00"
function formatTime(time: string): string {
  return time.split(' ')[1]?.substring(0, 5) ?? time
}
</script>

<template>
  <div
    class="rounded-xl sm:rounded-2xl px-3 sm:px-4 h-[62px] sm:h-[72px] flex items-center gap-0 overflow-hidden transition-colors duration-200"
    :style="
      theme === 'dark'
        ? {
            background: 'var(--dk-card)',
            border: '1px solid var(--dk-border-md)',
            backdropFilter: 'blur(16px)',
            boxShadow: 'var(--dk-shadow-md)'
          }
        : {
            background: 'rgba(255,255,255,0.82)',
            border: '1px solid rgba(255,255,255,0.70)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 4px 20px rgba(0,80,120,0.10), 0 1px 4px rgba(0,0,0,0.05)'
          }
    "
  >
    <template v-if="loading">
      <div class="flex items-center gap-3 w-full">
        <div class="w-8 h-8 rounded-full bg-slate-100 animate-pulse shrink-0"></div>
        <div class="space-y-1.5">
          <div class="h-4 w-16 bg-slate-100 rounded animate-pulse"></div>
          <div class="h-2.5 w-24 bg-slate-100 rounded animate-pulse"></div>
        </div>
      </div>
    </template>

    <template v-else-if="error">
      <div class="flex items-center gap-2 text-sm text-red-400">
        <AlertCircle class="w-4 h-4" />
        <span>Météo indisponible</span>
      </div>
    </template>

    <template v-else>
      <div
        class="flex items-center gap-2 sm:gap-2.5 shrink-0 pr-3 sm:pr-4 mr-3 sm:mr-4 border-r border-slate-100 dark:border-white/8"
      >
        <!-- WeatherAPI retourne des URLs sans protocole (//cdn.weatherapi.com/…) → on préfixe https: -->
        <img
          v-if="currentWeather?.condition.icon"
          :src="'https:' + currentWeather.condition.icon"
          :alt="currentWeather?.condition.text"
          class="w-8 h-8 sm:w-9 sm:h-9 shrink-0"
        />
        <div>
          <div
            class="text-[18px] sm:text-[22px] font-bold text-slate-800 dark:text-slate-100 leading-none tracking-tight"
          >
            {{ currentWeather?.temp_c }}°C
          </div>
          <div
            class="text-[10px] sm:text-[11px] text-slate-400 dark:text-[#8b949e] leading-tight mt-0.5 max-w-[80px] sm:max-w-[96px] truncate"
          >
            {{ currentWeather?.condition.text }}
          </div>
        </div>
      </div>

      <div
        class="shrink-0 pr-3 sm:pr-4 mr-3 sm:mr-4 border-r border-slate-100 dark:border-white/8 hidden sm:block"
      >
        <div
          class="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
        >
          <MapPin class="w-2.5 h-2.5 text-[#00b7cc]" />
          Nancy
        </div>
        <div class="flex items-center gap-3 mt-0.5">
          <span class="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Wind class="w-2.5 h-2.5 text-slate-400 dark:text-[#8b949e]" />
            {{ currentWeather?.wind_kph }} km/h
          </span>
          <span class="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Droplets class="w-2.5 h-2.5 text-slate-400 dark:text-[#8b949e]" />
            {{ currentWeather?.humidity }}%
          </span>
        </div>
      </div>

      <div class="flex overflow-x-auto min-w-0 flex-1 py-1 gap-1 sm:gap-0 no-scrollbar">
        <div
          v-for="hour in upcomingHours"
          :key="hour.time"
          class="shrink-0 flex flex-col items-center gap-0.5 px-1 sm:flex-1"
        >
          <span class="text-[10px] font-medium text-slate-400 dark:text-[#8b949e] tabular-nums">
            {{ formatTime(hour.time) }}
          </span>
          <img
            :src="'https:' + hour.condition.icon"
            :alt="hour.condition.text"
            class="w-5 h-5 sm:w-6 sm:h-6"
          />
          <span class="text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
            {{ hour.temp_c }}°
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

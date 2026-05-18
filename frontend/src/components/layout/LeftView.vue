<script setup lang="ts">
import { ref, watch } from 'vue'
import { MapPin, Bus, Navigation, AlertCircle } from 'lucide-vue-next'
import AppHeader from './AppHeader.vue'
import type { HeaderTab, Stop } from '@/types/types'
import StopSelector from '../transport/stops/StopSelector.vue'
import RouteSelector from '../transport/routes/RouteSelector.vue'
import DirectionSelector from '../transport/directions/DirectionSelector.vue'
import ArrivalsDisplay from '../transport/arrivals/ArrivalsDisplay.vue'
import WorkLegend from '../map/WorkLegend.vue'
import RouteTracer from '../transport/routes/RouteTracer.vue'
import ItineraryPanel from '../transport/itinerary/ItineraryPanel.vue'
import ItineraryResult from '../transport/itinerary/ItineraryResult.vue'
import { useTheme } from '@/composables/useTheme'
import { useTransportData } from '@/composables/useTransportData'
import { API_BASE } from '@/config/api'

// ── Thème ──────────────────────────────────────────────────────────────────

const { theme, toggle: toggleTheme } = useTheme()

// ── Données transport (stops → lignes → directions → passages) ─────────────

const {
  allStops,
  routes,
  directions,
  mergedArrivals,
  selectedStopName,
  selectedRoute,
  selectedDirection,
  selectedRouteColor,
  resultStopName,
  directionName,
  loadingStops,
  loadingRoutes,
  loadingDirections,
  loadingArrivals,
  error,
  uniqueStopNames,
  selectedRouteName,
  fetchStops,
  refreshArrivals,
} = useTransportData()

fetchStops()

// ── Retard moyen réseau ────────────────────────────────────────────────────

const averageDelay = ref<number | null>(null)

async function fetchAverageDelay() {
  try {
    const res = await fetch(`${API_BASE}/api/delays/average`)
    averageDelay.value = (await res.json()).averageDelayMin
  } catch {
  }
}

fetchAverageDelay()

// ── Navigation entre onglets ───────────────────────────────────────────────

const activeHeaderTab = ref<HeaderTab>('itineraires')

function onTabChange(tab: HeaderTab) {
  activeHeaderTab.value = tab
  if (tab === 'itineraires' || tab === 'trajet') {
    // Effacer la sélection arrêt : le composable remet routes/directions à zéro
    selectedStopName.value = ''
  } else {
    // Retour sur Horaires : resynchroniser la carte avec la sélection courante
    emit('update:selectedRouteId', selectedRoute.value)
    emit('update:selectedDirectionId', selectedDirection.value
      ? (selectedDirection.value.split('|')[1] ?? '')
      : '')
  }
}

// ── Bridge : remonte les changements du composable vers TransportView ──────

const emit = defineEmits<{
  'update:selectedStopName': [value: string]
  'update:allStops': [value: Stop[]]
  'update:selectedRouteId': [value: string]
  'update:selectedDirectionId': [value: string]
  'update:selectedRouteColor': [value: string]
}>()

watch(allStops, (stops) => emit('update:allStops', stops))
watch(selectedStopName, (name) => emit('update:selectedStopName', name))
watch(selectedRoute, (id) => emit('update:selectedRouteId', id))
watch(selectedDirection, (val) =>
  emit('update:selectedDirectionId', val ? (val.split('|')[1] ?? '') : ''),
)
watch(selectedRouteColor, (color) => emit('update:selectedRouteColor', color))
</script>

<template>
  <div
    class="flex flex-col h-full overflow-hidden dark:border-[#30363d]/60 dark:shadow-none"
    :style="theme === 'dark' ? 'background:var(--dk-surface)' : 'background:#f8f8ff'"
  >
    <!-- ── Header ──────────────────── -->
    <AppHeader
      :average-delay="averageDelay"
      :active-tab="activeHeaderTab"
      @tab-change="onTabChange"
      @toggle-theme="toggleTheme"
    />

    <!-- ── Contenu scrollable ──────────────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto">
      <Transition name="fade" mode="out-in">
        <!-- ── Onglet Horaires ── -->
        <div v-if="activeHeaderTab === 'horaires'" key="horaires" class="p-4 space-y-3">
          <!-- Étape 1 : Arrêt -->
          <div
            class="rounded-2xl border p-3 sm:p-4"
            :style="{ background: theme === 'dark' ? 'var(--dk-card)' : 'white', borderColor: theme === 'dark' ? 'var(--dk-border)' : 'rgba(0,0,0,0.07)', boxShadow: theme === 'dark' ? 'var(--dk-shadow-sm)' : '0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)' }"
          >
            <p
              class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-[#8b949e] uppercase tracking-widest mb-2"
            >
              <MapPin class="w-3.5 h-3.5 text-[#00b7cc]" />
              Arrêt
            </p>
            <StopSelector
              :loading="loadingStops"
              :stop-names="uniqueStopNames"
              @update:selected-stop="selectedStopName = $event"
            />
          </div>

          <!-- Étape 2 : Ligne -->
          <Transition name="fade">
            <div
              v-if="selectedStopName"
              class="rounded-2xl border shadow-sm p-3 sm:p-4"
              :style="{ background: theme === 'dark' ? 'var(--dk-card)' : 'white', borderColor: theme === 'dark' ? 'var(--dk-border)' : '#e8ecf3' }"
            >
              <p
                class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-[#8b949e] uppercase tracking-widest mb-2"
              >
                <Bus class="w-3.5 h-3.5 text-[#00b7cc]" />
                Ligne
              </p>
              <RouteSelector
                :routes="routes"
                :loading="loadingRoutes"
                :show="true"
                @update:selected-route="selectedRoute = $event"
              />
            </div>
          </Transition>

          <!-- Étape 3 : Direction -->
          <Transition name="fade">
            <div
              v-if="selectedRoute"
              class="rounded-2xl border shadow-sm p-3 sm:p-4"
              :style="{ background: theme === 'dark' ? 'var(--dk-card)' : 'white', borderColor: theme === 'dark' ? 'var(--dk-border)' : '#e8ecf3' }"
            >
              <p
                class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-[#8b949e] uppercase tracking-widest mb-2"
              >
                <Navigation class="w-3.5 h-3.5 text-[#00b7cc]" />
                Direction
              </p>
              <DirectionSelector
                :directions="directions"
                :loading="loadingDirections"
                :show="true"
                @update:selected-direction="selectedDirection = $event"
              />
            </div>
          </Transition>

          <!-- Étape 4 : Passages -->
          <Transition name="fade">
            <ArrivalsDisplay
              v-if="selectedDirection"
              :arrivals="mergedArrivals"
              :loading="loadingArrivals"
              :show="true"
              :stop-name="resultStopName || selectedStopName"
              :direction-name="directionName"
              :route-name="selectedRouteName"
              @refresh="refreshArrivals"
            />
          </Transition>

          <!-- Erreur -->
          <Transition name="fade">
            <div
              v-if="error"
              class="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-xl text-[13px] border border-red-100 dark:border-red-900/50"
            >
              <AlertCircle class="w-4 h-4 shrink-0" />
              {{ error }}
            </div>
          </Transition>
        </div>

        <!-- ── Onglet Itinéraires ── -->
        <div v-else-if="activeHeaderTab === 'itineraires'" key="itineraires" class="p-4">
          <div
            class="rounded-2xl border p-3 sm:p-4"
            :style="{ background: theme === 'dark' ? 'var(--dk-card)' : 'white', borderColor: theme === 'dark' ? 'var(--dk-border)' : 'rgba(0,0,0,0.07)', boxShadow: theme === 'dark' ? 'var(--dk-shadow-sm)' : '0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)' }"
          >
            <RouteTracer
              @update:selected-route-id="emit('update:selectedRouteId', $event)"
              @update:selected-direction-id="emit('update:selectedDirectionId', $event)"
              @update:selected-route-color="emit('update:selectedRouteColor', $event)"
            />
          </div>
        </div>

        <!-- ── Onglet Mon trajet ── -->
        <div v-else key="trajet" class="p-4 space-y-3">
          <ItineraryPanel />
          <ItineraryResult />
        </div>
      </Transition>
    </div>

    <!-- Légende incidents-->
    <WorkLegend />
  </div>
</template>

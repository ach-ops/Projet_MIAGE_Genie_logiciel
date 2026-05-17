<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Sun, Moon, Bus, Clock, Map, Navigation2 } from 'lucide-vue-next'
import WeatherComponent from './components/weather/WeatherComponent.vue'
import NewsTicker from './components/ui/NewsTicker.vue'
import MapComponent from './components/map/MapComponent.vue'
import StopSelector from './components/transport/stops/StopSelector.vue'
import RouteSelector from './components/transport/routes/RouteSelector.vue'
import DirectionSelector from './components/transport/directions/DirectionSelector.vue'
import ArrivalsDisplay from './components/transport/arrivals/ArrivalsDisplay.vue'
import RouteTracer from './components/transport/routes/RouteTracer.vue'
import ItineraryPanel from './components/transport/itinerary/ItineraryPanel.vue'
import ItineraryResult from './components/transport/itinerary/ItineraryResult.vue'
import { useTheme } from '@/composables/useTheme'
import { useTransportData } from '@/composables/useTransportData'
import { useItineraryStore } from '@/stores/itinerary'

const { theme, toggle } = useTheme()
const transport         = useTransportData()
const itinerary         = useItineraryStore()

// ── Onglet actif ───────────────────────────────────────────────────────────

type Tab = 'horaires' | 'trajet' | 'itineraires'
const activeTab = ref<Tab>('horaires')

// ── Tracé carte ────────────────────────────────────────────────────────────

const mapRouteId     = ref('')
const mapDirectionId = ref('')
const mapRouteColor  = ref('')

// ── Init ───────────────────────────────────────────────────────────────────

onMounted(() => {
  transport.fetchStops()
})
</script>

<template>
  <div class="app-shell" :class="{ dark: theme === 'dark' }">
    <!-- ── En-tête ──────────────────────────────────────────────────────── -->
    <header class="app-header">
      <div class="header-brand">
        <div class="brand-icon">
          <Bus class="w-4 h-4 text-white" />
        </div>
        <span class="brand-name">STAN Nancy</span>
      </div>

      <div class="header-weather">
        <WeatherComponent />
      </div>

      <button class="theme-toggle" @click="toggle" aria-label="Basculer le thème">
        <Sun v-if="theme === 'dark'" class="w-4 h-4" />
        <Moon v-else class="w-4 h-4" />
      </button>
    </header>

    <!-- ── Bandeau actualités ──────────────────────────────────────────── -->
    <div class="ticker-bar">
      <NewsTicker />
    </div>

    <!-- ── Corps ──────────────────────────────────────────────────────── -->
    <main class="app-main">
      <!-- ── Sidebar ─────────────────────────────────────────────────── -->
      <aside class="app-sidebar">
        <!-- Onglets -->
        <div class="tabs">
          <button
            class="tab-btn"
            :class="{ 'tab-btn--active': activeTab === 'horaires' }"
            @click="activeTab = 'horaires'"
          >
            <Clock class="w-3.5 h-3.5" />
            Horaires
          </button>
          <button
            class="tab-btn"
            :class="{ 'tab-btn--active': activeTab === 'trajet' }"
            @click="activeTab = 'trajet'"
          >
            <Map class="w-3.5 h-3.5" />
            Tracé
          </button>
          <button
            class="tab-btn"
            :class="{ 'tab-btn--active': activeTab === 'itineraires' }"
            @click="activeTab = 'itineraires'"
          >
            <Navigation2 class="w-3.5 h-3.5" />
            Itin.
          </button>
        </div>

        <!-- ── Onglet Horaires ───────────────────────────────────────── -->
        <div v-if="activeTab === 'horaires'" class="tab-content no-scrollbar">
          <div class="panel">
            <p class="panel-label">Arrêt</p>
            <StopSelector
              :loading="transport.loadingStops.value"
              :stop-names="transport.uniqueStopNames.value"
              @update:selected-stop="transport.selectedStopName.value = $event"
            />
          </div>

          <Transition name="slide-up">
            <div v-if="transport.selectedStopName.value" class="panel">
              <p class="panel-label">Ligne</p>
              <RouteSelector
                :routes="transport.routes.value"
                :loading="transport.loadingRoutes.value"
                :show="true"
                @update:selected-route="transport.selectedRoute.value = $event"
              />
            </div>
          </Transition>

          <Transition name="slide-up">
            <div v-if="transport.selectedRoute.value" class="panel">
              <p class="panel-label">Direction</p>
              <DirectionSelector
                :directions="transport.directions.value"
                :loading="transport.loadingDirections.value"
                :show="true"
                @update:selected-direction="transport.selectedDirection.value = $event"
              />
            </div>
          </Transition>

          <Transition name="slide-up">
            <ArrivalsDisplay
              v-if="transport.selectedDirection.value"
              :arrivals="transport.mergedArrivals.value"
              :loading="transport.loadingArrivals.value"
              :show="true"
              :stop-name="transport.resultStopName.value"
              :direction-name="transport.directionName.value"
              :route-name="transport.selectedRouteName.value"
              @refresh="transport.refreshArrivals()"
            />
          </Transition>

          <Transition name="fade">
            <div v-if="transport.error.value" class="error-banner">
              {{ transport.error.value }}
            </div>
          </Transition>
        </div>

        <!-- ── Onglet Tracé carte ────────────────────────────────────── -->
        <div v-else-if="activeTab === 'trajet'" class="tab-content no-scrollbar">
          <div class="panel">
            <RouteTracer
              @update:selected-route-id="mapRouteId = $event"
              @update:selected-direction-id="mapDirectionId = $event"
              @update:selected-route-color="mapRouteColor = $event"
            />
          </div>
        </div>

        <!-- ── Onglet Itinéraires ─────────────────────────────────────── -->
        <div v-else class="tab-content no-scrollbar">
          <ItineraryPanel />
          <Transition name="slide-up">
            <ItineraryResult v-if="itinerary.result || itinerary.loading || itinerary.error" />
          </Transition>
        </div>
      </aside>

      <!-- ── Zone carte ─────────────────────────────────────────────── -->
      <div class="map-area">
        <div class="map-wrapper">
          <MapComponent
            :all-stops="transport.allStops.value"
            :selected-stop-name="transport.selectedStopName.value || undefined"
            :selected-route-id="mapRouteId || undefined"
            :selected-direction-id="mapDirectionId || undefined"
            :selected-route-color="mapRouteColor || undefined"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #e2eaf4;
  color: #0f172a;
  transition: background 0.2s ease, color 0.2s ease;
}
.app-shell.dark {
  background: var(--dk-bg);
  color: var(--dk-text-1);
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.app-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  flex-shrink: 0;
  background: white;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 4px rgba(0, 80, 120, 0.06);
}
.app-shell.dark .app-header {
  background: var(--dk-surface);
  border-bottom-color: var(--dk-border);
  box-shadow: none;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.brand-icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: #00b7cc;
  display: flex;
  align-items: center;
  justify-content: center;
}
.brand-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
  display: none;
}
@media (min-width: 640px) {
  .brand-name { display: block; }
}

.header-weather { flex: 1; min-width: 0; }

.theme-toggle {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #f1f5f9;
  color: #475569;
  transition: background 0.15s;
  padding: 0;
}
.theme-toggle:hover { background: #e2e8f0; }
.app-shell.dark .theme-toggle {
  background: rgba(255, 255, 255, 0.07);
  color: var(--dk-text-2);
}
.app-shell.dark .theme-toggle:hover { background: rgba(255, 255, 255, 0.12); }

/* ── Ticker ─────────────────────────────────────────────────────────────── */
.ticker-bar {
  padding: 8px 16px;
  flex-shrink: 0;
}

/* ── Main layout ────────────────────────────────────────────────────────── */
.app-main {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 12px;
  padding: 0 16px 16px;
}

/* ── Sidebar ────────────────────────────────────────────────────────────── */
.app-sidebar {
  width: 288px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ── Tabs ───────────────────────────────────────────────────────────────── */
.tabs {
  display: flex;
  gap: 3px;
  padding: 4px;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 14px;
  margin-bottom: 10px;
  flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0, 80, 120, 0.05);
}
.app-shell.dark .tabs {
  background: var(--dk-card);
  border-color: var(--dk-border);
  box-shadow: var(--dk-shadow-sm);
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 6px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-size: 11.5px;
  font-weight: 600;
  transition: background 0.15s, color 0.15s;
  background: transparent;
  color: #64748b;
  white-space: nowrap;
}
.tab-btn:hover { background: #f8fafc; }
.tab-btn--active {
  background: #007a8a;
  color: white;
}
.app-shell.dark .tab-btn { color: var(--dk-text-2); }
.app-shell.dark .tab-btn:hover { background: rgba(255, 255, 255, 0.06); }
.app-shell.dark .tab-btn--active {
  background: var(--dk-accent);
  color: #0d1117;
}

/* ── Tab content ────────────────────────────────────────────────────────── */
.tab-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Panel card ─────────────────────────────────────────────────────────── */
.panel {
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 14px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 1px 4px rgba(0, 80, 120, 0.05);
  flex-shrink: 0;
}
.app-shell.dark .panel {
  background: var(--dk-card);
  border-color: var(--dk-border);
  box-shadow: var(--dk-shadow-sm);
}

.panel-label {
  margin: 0;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
}
.app-shell.dark .panel-label { color: var(--dk-text-2); }

.error-banner {
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 13px;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  flex-shrink: 0;
}
.app-shell.dark .error-banner {
  background: #3a1515;
  border-color: #7f1d1d;
  color: #fca5a5;
}

/* ── Zone carte (droite) ─────────────────────────────────────────────────── */
.map-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Map ─────────────────────────────────────────────────────────────────── */
.map-wrapper {
  flex: 1;
  min-height: 0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 80, 120, 0.1);
}
.app-shell.dark .map-wrapper {
  box-shadow: var(--dk-shadow-md);
}
</style>

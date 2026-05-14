<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Sun, Moon, Bus } from 'lucide-vue-next'
import WeatherComponent from './components/weather/WeatherComponent.vue'
import NewsTicker from './components/ui/NewsTicker.vue'
import MapComponent from './components/map/MapComponent.vue'
import ArrivalsDisplay from './components/transport/arrivals/ArrivalsDisplay.vue'
import { useTheme } from '@/composables/useTheme'
import { useRouteBadge } from '@/composables/useRouteBadge'
import { API_BASE } from '@/config/api'
import type { Stop, RouteInfo, Direction, MergedArrival } from '@/types/types'

const { theme, toggle } = useTheme()
const { badgeStyle, sortByType } = useRouteBadge()

// ── Données de base ────────────────────────────────────────────────────────

const allStops = ref<Stop[]>([])
const routes = ref<RouteInfo[]>([])
const directions = ref<Direction[]>([])
const directionStops = ref<Stop[]>([])

// ── Sélections ─────────────────────────────────────────────────────────────

const selectedRouteId = ref('')
const selectedRouteColor = ref('')
const selectedDirectionId = ref('')
const selectedStopName = ref('')

// ── Arrivées ───────────────────────────────────────────────────────────────

const arrivals = ref<MergedArrival[]>([])
const arrivalsLoading = ref(false)
const showArrivals = ref(false)
const arrivalsStopName = ref('')
const arrivalsDirectionName = ref('')
const arrivalsRouteName = ref('')

// ── Chargement initial ─────────────────────────────────────────────────────

async function loadStops() {
  const res = await fetch(`${API_BASE}/api/stops`)
  const data = await res.json()
  allStops.value = data.stops ?? data
}

async function loadRoutes() {
  const res = await fetch(`${API_BASE}/api/routes`)
  const data: RouteInfo[] = (await res.json()) ?? []
  routes.value = sortByType(data)
}

// ── Handlers sélection ─────────────────────────────────────────────────────

async function onRouteChange() {
  selectedDirectionId.value = ''
  selectedStopName.value = ''
  directions.value = []
  directionStops.value = []
  showArrivals.value = false

  if (!selectedRouteId.value) return

  const route = routes.value.find((r) => r.route_id === selectedRouteId.value)
  selectedRouteColor.value = route?.route_color ? `#${route.route_color}` : '#00b7cc'

  const res = await fetch(
    `${API_BASE}/api/routes/${encodeURIComponent(selectedRouteId.value)}/directions`
  )
  directions.value = (await res.json()) ?? []
}

async function onDirectionChange() {
  selectedStopName.value = ''
  directionStops.value = []
  showArrivals.value = false

  if (!selectedRouteId.value || !selectedDirectionId.value) return

  const res = await fetch(
    `${API_BASE}/api/routes/${encodeURIComponent(selectedRouteId.value)}/directions/${encodeURIComponent(selectedDirectionId.value)}/stops`
  )
  const data = await res.json()
  const rawStops: {
    stopId?: string
    stop_id?: string
    stopName?: string
    stop_name?: string
    lat?: number
    stop_lat?: string
    lon?: number
    stop_lon?: string
  }[] = data.stops ?? data

  directionStops.value = rawStops.map((s) => ({
    stop_id: s.stopId ?? s.stop_id ?? '',
    stop_name: s.stopName ?? s.stop_name ?? '',
    stop_lat: String(s.lat ?? s.stop_lat ?? ''),
    stop_lon: String(s.lon ?? s.stop_lon ?? '')
  }))
}

async function fetchArrivals() {
  const stop =
    directionStops.value.find((s) => s.stop_name === selectedStopName.value) ??
    allStops.value.find((s) => s.stop_name === selectedStopName.value)
  if (!stop) return

  const route = routes.value.find((r) => r.route_id === selectedRouteId.value)
  const direction = directions.value.find(
    (d) => String(d.directionId) === selectedDirectionId.value
  )

  arrivalsStopName.value = selectedStopName.value
  arrivalsDirectionName.value = direction?.label ?? ''
  arrivalsRouteName.value = route?.route_short_name ?? ''
  arrivalsLoading.value = true
  showArrivals.value = true
  arrivals.value = []

  try {
    const res = await fetch(
      `${API_BASE}/api/stops/${encodeURIComponent(stop.stop_id)}/arrivals` +
        `?routeId=${encodeURIComponent(selectedRouteId.value)}` +
        `&directionId=${encodeURIComponent(selectedDirectionId.value)}`
    )
    arrivals.value = (await res.json()) ?? []
  } catch {
    arrivals.value = []
  } finally {
    arrivalsLoading.value = false
  }
}

onMounted(() => {
  void loadStops()
  void loadRoutes()
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

    <!-- ── Corps principal ────────────────────────────────────────────── -->
    <main class="app-main">
      <!-- Panneau gauche -->
      <aside class="app-sidebar no-scrollbar">
        <!-- Sélecteur de ligne -->
        <div class="panel">
          <p class="panel-label">Ligne</p>
          <div class="route-grid no-scrollbar">
            <button
              v-for="route in routes"
              :key="route.route_id"
              class="route-badge"
              :style="badgeStyle(route)"
              :class="{ 'route-badge--active': selectedRouteId === route.route_id }"
              @click="selectedRouteId = route.route_id; onRouteChange()"
            >
              {{ route.route_short_name }}
            </button>
          </div>
        </div>

        <!-- Sélecteur de direction -->
        <Transition name="slide-up">
          <div v-if="directions.length" class="panel">
            <p class="panel-label">Direction</p>
            <div class="stack">
              <button
                v-for="dir in directions"
                :key="dir.directionId"
                class="list-btn"
                :class="{ 'list-btn--active': selectedDirectionId === String(dir.directionId) }"
                @click="selectedDirectionId = String(dir.directionId); onDirectionChange()"
              >
                {{ dir.label }}
              </button>
            </div>
          </div>
        </Transition>

        <!-- Sélecteur d'arrêt -->
        <Transition name="slide-up">
          <div v-if="directionStops.length" class="panel">
            <p class="panel-label">Arrêt</p>
            <div class="stop-list no-scrollbar">
              <button
                v-for="stop in directionStops"
                :key="stop.stop_id"
                class="list-btn list-btn--sm"
                :class="{ 'list-btn--active': selectedStopName === stop.stop_name }"
                @click="selectedStopName = stop.stop_name; fetchArrivals()"
              >
                {{ stop.stop_name }}
              </button>
            </div>
          </div>
        </Transition>

        <!-- Arrivées -->
        <Transition name="slide-up">
          <ArrivalsDisplay
            v-if="showArrivals"
            :arrivals="arrivals"
            :loading="arrivalsLoading"
            :show="showArrivals"
            :stop-name="arrivalsStopName"
            :direction-name="arrivalsDirectionName"
            :route-name="arrivalsRouteName"
            @refresh="fetchArrivals"
          />
        </Transition>
      </aside>

      <!-- Carte -->
      <div class="map-wrapper">
        <MapComponent
          :all-stops="allStops"
          :selected-stop-name="selectedStopName || undefined"
          :selected-route-id="selectedRouteId || undefined"
          :selected-direction-id="selectedDirectionId || undefined"
          :selected-route-color="selectedRouteColor || undefined"
        />
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ── Shell ──────────────────────────────────────────────────────────────── */
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #e2eaf4;
  color: #0f172a;
  transition:
    background 0.2s ease,
    color 0.2s ease;
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
  .brand-name {
    display: block;
  }
}

.header-weather {
  flex: 1;
  min-width: 0;
}

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
  color: #64748b;
  transition:
    background 0.15s,
    color 0.15s;
  padding: 0;
}
.theme-toggle:hover {
  background: #e2e8f0;
}
.app-shell.dark .theme-toggle {
  background: rgba(255, 255, 255, 0.07);
  color: var(--dk-text-2);
}
.app-shell.dark .theme-toggle:hover {
  background: rgba(255, 255, 255, 0.12);
}

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
  width: 272px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
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
.app-shell.dark .panel-label {
  color: var(--dk-text-2);
}

/* ── Routes grid ────────────────────────────────────────────────────────── */
.route-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 160px;
  overflow-y: auto;
}

.route-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 7px;
  border: none;
  cursor: pointer;
  opacity: 0.82;
  transition:
    opacity 0.12s,
    box-shadow 0.12s;
}
.route-badge:hover {
  opacity: 1;
}
.route-badge--active {
  opacity: 1;
  box-shadow:
    0 0 0 2px white,
    0 0 0 4px #00b7cc;
}
.app-shell.dark .route-badge--active {
  box-shadow:
    0 0 0 2px var(--dk-card),
    0 0 0 4px var(--dk-accent);
}

/* ── List buttons (direction / arrêt) ────────────────────────────────────── */
.stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stop-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 192px;
  overflow-y: auto;
}

.list-btn {
  text-align: left;
  font-size: 12px;
  padding: 7px 10px;
  border-radius: 9px;
  border: none;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
  background: #f8fafc;
  color: #475569;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.list-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.app-shell.dark .list-btn {
  background: rgba(255, 255, 255, 0.04);
  color: var(--dk-text-2);
}
.app-shell.dark .list-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--dk-text-1);
}

.list-btn--active {
  background: #00b7cc !important;
  color: white !important;
  font-weight: 600;
}

.list-btn--sm {
  font-size: 12px;
  padding: 5px 10px;
}

/* ── Map ─────────────────────────────────────────────────────────────────── */
.map-wrapper {
  flex: 1;
  min-width: 0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 80, 120, 0.1);
}
.app-shell.dark .map-wrapper {
  box-shadow: var(--dk-shadow-md);
}
</style>

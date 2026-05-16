<script setup lang="ts">
import { ref } from 'vue'
import MapComponent from './components/map/MapComponent.vue'
import NewsTicker from './components/ui/NewsTicker.vue'
import WeatherComponent from './components/weather/WeatherComponent.vue'
import LeftView from './components/layout/LeftView.vue'
import type { Stop } from '@/types/types'

const allStops         = ref<Stop[]>([])
const selectedStopName = ref('')
const mapRouteId       = ref('')
const mapDirectionId   = ref('')
const mapRouteColor    = ref('')
</script>

<template>
  <div class="app-shell">
    <main class="app-main">
      <!-- ── Sidebar (header + onglets + contenu) ────────────────────── -->
      <LeftView
        class="app-sidebar"
        @update:all-stops="allStops = $event"
        @update:selected-stop-name="selectedStopName = $event"
        @update:selected-route-id="mapRouteId = $event"
        @update:selected-direction-id="mapDirectionId = $event"
        @update:selected-route-color="mapRouteColor = $event"
      />

      <!-- ── Zone carte ────────────────────────────────────────────────── -->
      <div class="map-area">
        <!-- Météo -->
        <div class="weather-bar">
          <WeatherComponent />
        </div>

        <!-- Bandeau actualités -->
        <div class="ticker-bar">
          <NewsTicker />
        </div>

        <!-- Carte -->
        <div class="map-wrapper">
          <MapComponent
            :all-stops="allStops"
            :selected-stop-name="selectedStopName || undefined"
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

/* ── Main layout ────────────────────────────────────────────────────────── */
.app-main {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 12px;
  padding: 16px 16px 16px 0;
}

/* ── Sidebar ────────────────────────────────────────────────────────────── */
.app-sidebar {
  width: 288px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ── Zone carte (droite) ─────────────────────────────────────────────────── */
.map-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Météo ────────────────────────────────────────────────────────────────── */
.weather-bar {
  flex-shrink: 0;
}

/* ── Map ─────────────────────────────────────────────────────────────────── */
.map-wrapper {
  flex: 1;
  min-height: 0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 80, 120, 0.1);
}

/* ── Ticker ─────────────────────────────────────────────────────────────── */
.ticker-bar {
  flex-shrink: 0;
}
</style>

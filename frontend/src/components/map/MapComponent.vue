<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import icons from '../../types/icon'
import velibIconImage from '../../img/velo-icon.png'
import type { Incident, Stop } from '@/types/types'
import { useTheme } from '@/composables/useTheme'
import VelibControl from './VelibControl.vue'
import { API_BASE } from '@/config/api'

const { theme } = useTheme()

// ── Props ──────────────────────────────────────────────────────────────────

const props = defineProps<{
  selectedStopName?: string
  allStops: Stop[]
  selectedRouteId?: string
  selectedDirectionId?: string
  selectedRouteColor?: string
}>()

// ── État carte ─────────────────────────────────────────────────────────────

const mapContainer = ref<HTMLDivElement | null>(null)
const map = shallowRef<google.maps.Map | null>(null)
const stopMarker = shallowRef<google.maps.Marker | null>(null)
let routePolylines: google.maps.Polyline[] = []
let routeStopMarkers: google.maps.Marker[] = []

// ── État Vélib ─────────────────────────────────────────────────────────────

const velibMarkers = shallowRef<google.maps.Marker[]>([])
const velibVisible = ref(true)
const velibLoading = ref(false)
const velibCount = ref(0)
let velibRefreshTimer: ReturnType<typeof setInterval> | null = null

type VelibStation = {
  stationId: string
  name: string
  address: string
  lat: number
  lon: number
  bikesAvailable: number
  docksAvailable: number
}

// ── Thème ──────────────────────────────────────────────────────────────────

const DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  {
    featureType: 'administrative.country',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9e9e9e' }]
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#bdbdbd' }]
  },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'poi.park', elementType: 'labels.text.stroke', stylers: [{ color: '#1b1b1b' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry',
    stylers: [{ color: '#4e4e4e' }]
  },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] }
]

// ── InfoWindow ──────────────────────────────────────────────────────

let activeInfoWindow: google.maps.InfoWindow | null = null

function openInfoWindow(marker: google.maps.Marker, content: string) {
  if (activeInfoWindow) activeInfoWindow.close()
  activeInfoWindow = new google.maps.InfoWindow({ content })
  activeInfoWindow.open(map.value!, marker)
  ;(globalThis as Record<string, unknown>).__closeActivePopup = () => activeInfoWindow?.close()
}

// ── Icône personnalisée ────────────────────────────────────────────────────

function markerIcon(url: string, size = 32): google.maps.Icon {
  return {
    url,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size)
  }
}

// Choisit l'icône d'incident en fonction de mots-clés dans la description
function getTravauxIconUrl(desc: string): string {
  const text = desc.toLowerCase()
  if (text.includes('eau')) return icons.eau
  if (text.includes('chauffage')) return icons.chauffage
  if (text.includes('chantier')) return icons.travaux
  if (text.includes('voirie')) return icons.voirie
  return icons.default
}

// ── Stations Vélib ─────────────────────────────────────────────────────────

async function loadVelibStations() {
  if (!map.value) return
  velibLoading.value = true

  velibMarkers.value.forEach((m) => m.setMap(null))
  velibMarkers.value = []
  velibCount.value = 0

  try {
    const res = await fetch(`${API_BASE}/api/velib/stations`)
    const data = await res.json()
    const stations = (data?.stations || []) as VelibStation[]

    for (const station of stations) {
      const lat = Number(station.lat)
      const lng = Number(station.lon)
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue

      const bikes = Number(station.bikesAvailable ?? 0)
      const docks = Number(station.docksAvailable ?? 0)
      const total = bikes + docks
      const bikePercent = total > 0 ? Math.round((bikes / total) * 100) : 0
      // Couleur selon disponibilité : rouge si vide, orange si ≤ 2, vert/bleu sinon
      const bikeColor = bikes === 0 ? '#ef4444' : bikes <= 2 ? '#f59e0b' : '#00b7cc'
      const dockColor = docks === 0 ? '#ef4444' : docks <= 2 ? '#f59e0b' : '#10b981'
      const isDark = theme.value === 'dark'

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: velibVisible.value ? map.value : null,
        icon: {
          url: velibIconImage,
          scaledSize: new google.maps.Size(35, 35),
          anchor: new google.maps.Point(17, 17)
        }
      })

      const content = `<div class="font-sans w-[210px] overflow-hidden">
        <div class="relative bg-gradient-to-br from-[#00b7cc] to-[#0099ad] pl-3.5 pr-8 pt-3 pb-2.5">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
            <div class="min-w-0">
              <div class="text-white text-xs font-bold leading-snug break-words">${station.name}</div>
              <div class="text-white/75 text-[10px] mt-0.5 leading-snug break-words">${station.address || 'Nancy'}</div>
            </div>
          </div>
          <button onclick="globalThis.__closeActivePopup()" class="absolute top-1.5 right-2 w-4 h-4 rounded-full bg-white/25 flex items-center justify-center hover:bg-white/40 transition-colors cursor-pointer border-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l6 6M7 1L1 7"/></svg>
          </button>
        </div>
        <div class="p-3 px-3.5 ${isDark ? 'bg-[#21252f]' : 'bg-white'}">
          <div class="flex gap-2 mb-2.5">
            <div class="flex-1 rounded-xl p-2 border ${isDark ? 'bg-[#1b1f28] border-white/[0.08]' : 'bg-slate-50 border-[#e8ecf3]'}">
              <div class="text-[10px] font-medium mb-0.5 uppercase tracking-[0.4px] ${isDark ? 'text-[#8892a8]' : 'text-slate-400'}">Vélos</div>
              <div class="text-xl font-extrabold leading-none" style="color:${bikeColor}">${bikes}</div>
              <div class="text-[10px] mt-0.5 ${isDark ? 'text-[#8892a8]' : 'text-slate-400'}">disponibles</div>
            </div>
            <div class="flex-1 rounded-xl p-2 border ${isDark ? 'bg-[#1b1f28] border-white/[0.08]' : 'bg-slate-50 border-[#e8ecf3]'}">
              <div class="text-[10px] font-medium mb-0.5 uppercase tracking-[0.4px] ${isDark ? 'text-[#8892a8]' : 'text-slate-400'}">Places</div>
              <div class="text-xl font-extrabold leading-none" style="color:${dockColor}">${docks}</div>
              <div class="text-[10px] mt-0.5 ${isDark ? 'text-[#8892a8]' : 'text-slate-400'}">libres</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex-1 h-[5px] rounded-full overflow-hidden ${isDark ? 'bg-white/[0.08]' : 'bg-[#e8ecf3]'}">
              <div class="h-full rounded-full transition-[width] duration-300" style="width:${bikePercent}%;background-color:${bikeColor}"></div>
            </div>
            <span class="text-[10px] font-semibold flex-shrink-0 ${isDark ? 'text-[#8892a8]' : 'text-slate-400'}">${bikePercent}%</span>
          </div>
        </div>
      </div>`

      marker.addListener('click', () => openInfoWindow(marker, content))
      velibMarkers.value.push(marker)
      velibCount.value += 1
    }
  } catch (err) {
    console.error('Erreur chargement Velib:', err)
  } finally {
    velibLoading.value = false
  }
}

function toggleVelibLayer() {
  velibVisible.value = !velibVisible.value
  const target = velibVisible.value ? map.value : null
  velibMarkers.value.forEach((m) => m.setMap(target as google.maps.Map | null))
  if (velibVisible.value && velibMarkers.value.length === 0) {
    void loadVelibStations()
  }
}

// ── Incidents / Travaux ────────────────────────────────────────────────────

async function loadTravaux() {
  const res = await fetch(`${API_BASE}/api/travaux/incidents`)
  const data = await res.json()
  if (!map.value) return
  const isDark = theme.value === 'dark'

  data.incidents.forEach((incident: Incident) => {
    const parts = incident.location.polyline.split(' ').map(Number)
    const lat = parts[0]
    const lng = parts[1]
    if (!lat || !lng) return

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: map.value!,
      icon: markerIcon(getTravauxIconUrl(incident.short_description))
    })

    const content = `<div class="font-sans min-w-[200px]">
      <div class="relative bg-gradient-to-br from-[#00b7cc] to-[#0099ad] pl-3.5 pr-8 py-2.5">
        <span class="text-white text-[13px] font-bold leading-snug">${incident.short_description}</span>
        <button onclick="globalThis.__closeActivePopup()" class="absolute top-1.5 right-2 w-4 h-4 rounded-full bg-white/25 flex items-center justify-center hover:bg-white/40 transition-colors cursor-pointer border-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l6 6M7 1L1 7"/></svg>
        </button>
      </div>
      <div class="px-3.5 py-[7px] ${isDark ? 'bg-[#21252f]' : 'bg-white'}">
        <span class="text-[11px] font-medium ${isDark ? 'text-[#8892a8]' : 'text-slate-400'}">${incident.location.location_description}</span>
      </div>
    </div>`

    marker.addListener('click', () => openInfoWindow(marker, content))
  })
}

// ── Arrêt sélectionné ──────────────────────────────────────────────────────

function showStopOnMap(stopName: string) {
  if (!map.value) return
  const stop = props.allStops.find((s) => s.stop_name === stopName)
  if (!stop) return

  const lat = Number(stop.stop_lat)
  const lng = Number(stop.stop_lon)
  const isDark = theme.value === 'dark'

  stopMarker.value?.setMap(null)

  stopMarker.value = new google.maps.Marker({
    position: { lat, lng },
    map: map.value,
    icon: markerIcon(icons.busIcon, 60)
  })

  const content = `<div class="font-sans min-w-[160px]">
    <div class="relative bg-gradient-to-br from-[#00b7cc] to-[#0099ad] pl-3.5 pr-8 py-2.5">
      <span class="text-white text-[13px] font-bold leading-snug">${stop.stop_name}</span>
      <button onclick="globalThis.__closeActivePopup()" class="absolute top-1.5 right-2 w-4 h-4 rounded-full bg-white/25 flex items-center justify-center hover:bg-white/40 transition-colors cursor-pointer border-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l6 6M7 1L1 7"/></svg>
      </button>
    </div>
    <div class="px-3.5 py-[7px] ${isDark ? 'bg-[#21252f]' : 'bg-white'}">
      <span class="text-[11px] font-medium ${isDark ? 'text-[#8892a8]' : 'text-slate-400'}">Arrêt sélectionné</span>
    </div>
  </div>`

  openInfoWindow(stopMarker.value, content)
  map.value.setCenter({ lat, lng })
  map.value.setZoom(15)
}

watch(
  () => props.selectedStopName,
  (name) => {
    if (name) {
      showStopOnMap(name)
    } else {
      stopMarker.value?.setMap(null)
      stopMarker.value = null
    }
  }
)

// ── Tracé de ligne ─────────────────────────────────────────────────────────

function clearRouteLayers() {
  routePolylines.forEach((p) => p.setMap(null))
  routePolylines = []
  routeStopMarkers.forEach((m) => m.setMap(null))
  routeStopMarkers = []
}

// Compteur de génération : permet d'abandonner un dessin si une nouvelle sélection arrive pendant un fetch
let drawGeneration = 0
let activeAbort: AbortController | null = null
let drawTimer: ReturnType<typeof setTimeout> | null = null

async function runDraw(routeId: string, directionId: string, lineColor: string) {
  if (!map.value) return
  const gen = ++drawGeneration
  activeAbort = new AbortController()
  const signal = activeAbort.signal

  clearRouteLayers()
  if (!routeId) return

  async function drawDirection(dId: string | number, idx: number, showStops: boolean) {
    const shapeRes = fetch(
      `${API_BASE}/api/routes/${encodeURIComponent(routeId)}/directions/${encodeURIComponent(String(dId))}/shape`,
      { signal }
    )
    const stopsRes = fetch(
      `${API_BASE}/api/routes/${encodeURIComponent(routeId)}/directions/${encodeURIComponent(String(dId))}/stops`,
      { signal }
    )
    const [shapeData, stopsData] = await Promise.all([
      shapeRes.then((r) => r.json()),
      stopsRes.then((r) => r.json())
    ])

    if (gen !== drawGeneration) return

    const points: [number, number][] = shapeData.points || []
    const stops: { lat: number; lon: number; stopName: string }[] = stopsData.stops || []
    const validStops = stops.filter((s) => !Number.isNaN(s.lat) && !Number.isNaN(s.lon))
    // Si pas de shape GPS, on relie les arrêts entre eux à la place
    const linePoints = points.length > 0 ? points : validStops.map((s): [number, number] => [s.lat, s.lon])

    if (linePoints.length > 1) {
      routePolylines.push(new google.maps.Polyline({
        path: linePoints.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: lineColor,
        strokeWeight: 5,
        strokeOpacity: idx === 0 ? 0.85 : 0.55,
        map: map.value!
      }))
    }

    if (showStops) {
      const isDark = theme.value === 'dark'
      for (const stop of validStops) {
        const stopMk = new google.maps.Marker({
          position: { lat: stop.lat, lng: stop.lon },
          map: map.value!,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: '#ffffff',
            fillOpacity: 1,
            strokeColor: lineColor,
            strokeWeight: 3
          }
        })
        const content = `<div class="font-sans min-w-[160px]">
          <div class="relative pl-3.5 pr-8 py-2.5" style="background:linear-gradient(135deg,${lineColor},${lineColor}cc)">
            <span class="text-white text-[13px] font-bold leading-snug">${stop.stopName}</span>
            <button onclick="globalThis.__closeActivePopup()" class="absolute top-1.5 right-2 w-4 h-4 rounded-full bg-white/25 flex items-center justify-center hover:bg-white/40 transition-colors cursor-pointer border-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l6 6M7 1L1 7"/></svg>
            </button>
          </div>
          <div class="px-3.5 py-[7px] ${isDark ? 'bg-[#21252f]' : 'bg-white'}">
            <span class="text-[11px] font-medium ${isDark ? 'text-[#8892a8]' : 'text-slate-400'}">Arrêt</span>
          </div>
        </div>`
        stopMk.addListener('click', () => openInfoWindow(stopMk, content))
        routeStopMarkers.push(stopMk)
      }
    }
  }

  try {
    if (directionId) {
      await drawDirection(directionId, 0, true)
    } else {
      const directionsData: { directionId: number | string }[] = await fetch(
        `${API_BASE}/api/routes/${encodeURIComponent(routeId)}/directions`,
        { signal }
      ).then((r) => r.json())
      await Promise.all((directionsData || []).map((d, idx) => drawDirection(d.directionId, idx, false)))
    }

    if (gen !== drawGeneration) return

    if (routePolylines.length > 0 || routeStopMarkers.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      routePolylines.forEach((p) => p.getPath().forEach((pt) => bounds.extend(pt)))
      routeStopMarkers.forEach((m) => { const pos = m.getPosition(); if (pos) bounds.extend(pos) })
      if (!bounds.isEmpty()) map.value!.fitBounds(bounds, 30)
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
  }
}

watch(
  () => [props.selectedRouteId, props.selectedDirectionId, props.selectedRouteColor],
  ([routeId, directionId, color]) => {
    // Annule immédiatement le timer et les requêtes en cours
    if (drawTimer !== null) { clearTimeout(drawTimer); drawTimer = null }
    activeAbort?.abort()

    // Debounce 150 ms pour éviter de lancer un fetch à chaque keystroke lors d'une sélection rapide
    drawTimer = setTimeout(() => {
      drawTimer = null
      void runDraw(routeId as string, directionId as string, (color as string) || '#2563eb')
    }, 150)
  }
)

// ── Changement de thème ────────────────────────────────────────────────────

// Changement de thème : on recharge les styles + les popups Vélib
watch(theme, (t) => {
  map.value?.setOptions({ styles: t === 'dark' ? DARK_STYLES : [] })
  void loadVelibStations()
  if (props.selectedStopName) showStopOnMap(props.selectedStopName)
})

// ── Cycle de vie ───────────────────────────────────────────────────────────

onMounted(async () => {
  setOptions({
    key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    v: 'weekly'
  })

  await Promise.all([
    importLibrary('maps'),
    importLibrary('core'),
    importLibrary('marker')
  ])

  if (!mapContainer.value) return

  map.value = new google.maps.Map(mapContainer.value, {
    center: { lat: 48.6921, lng: 6.1844 },
    zoom: 13,
    styles: theme.value === 'dark' ? DARK_STYLES : [],
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  })

  void loadTravaux()
  void loadVelibStations()
  // Actualisation automatique des Vélib toutes les 60 s
  velibRefreshTimer = globalThis.setInterval(() => void loadVelibStations(), 60_000)
})

onUnmounted(() => {
  if (velibRefreshTimer !== null) {
    globalThis.clearInterval(velibRefreshTimer)
    velibRefreshTimer = null
  }
})
</script>

<template>
  <div class="w-full h-full relative">
    <div ref="mapContainer" class="w-full h-full"></div>

    <VelibControl
      :visible="velibVisible"
      :loading="velibLoading"
      :count="velibCount"
      @toggle="toggleVelibLayer"
      @refresh="loadVelibStations"
    />
  </div>
</template>

<style>
.gm-style .gm-style-iw-c {
  padding: 0 !important;
  border-radius: 12px !important;
  overflow: hidden !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 8px 24px rgba(2, 8, 20, 0.13) !important;
  max-width: none !important;
}
.gm-style .gm-style-iw-d { overflow: hidden !important; padding: 0 !important; }
.gm-style .gm-style-iw-chr { height: 0 !important; }
.gm-style .gm-ui-hover-effect { display: none !important; }
</style>

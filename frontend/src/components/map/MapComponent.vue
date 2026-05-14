<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
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
const map = ref<google.maps.Map | null>(null)
const stopMarker = ref<google.maps.Marker | null>(null)
const routePolylines = ref<google.maps.Polyline[]>([])
const routeStopMarkers = ref<google.maps.Marker[]>([])

// ── État Vélib ─────────────────────────────────────────────────────────────

const velibMarkers = ref<google.maps.Marker[]>([])
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

// ── InfoWindow active ──────────────────────────────────────────────────────

let activeInfoWindow: google.maps.InfoWindow | null = null

function openInfoWindow(marker: google.maps.Marker, content: string) {
  if (activeInfoWindow) activeInfoWindow.close()
  activeInfoWindow = new google.maps.InfoWindow({ content })
  activeInfoWindow.open(map.value!, marker)
}

// ── Icône personnalisée ────────────────────────────────────────────────────

function markerIcon(url: string, size = 32): google.maps.Icon {
  return {
    url,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size)
  }
}

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

      const content = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;width:210px;padding:0;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#00b7cc,#0099ad);padding:12px 30px 10px 14px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;background:rgba(255,255,255,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
            <div style="min-width:0;">
              <div style="color:white;font-size:12px;font-weight:700;line-height:1.3;word-break:break-word;">${station.name}</div>
              <div style="color:rgba(255,255,255,0.75);font-size:10px;margin-top:3px;line-height:1.4;word-break:break-word;">${station.address || 'Nancy'}</div>
            </div>
          </div>
        </div>
        <div style="padding:12px 14px;background:${isDark ? '#21252f' : 'white'};">
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <div style="flex:1;background:${isDark ? '#1b1f28' : '#f8fafc'};border-radius:10px;padding:8px 10px;border:1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e8ecf3'};">
              <div style="font-size:10px;color:${isDark ? '#8892a8' : '#94a3b8'};font-weight:500;margin-bottom:3px;text-transform:uppercase;letter-spacing:.4px;">Vélos</div>
              <div style="font-size:20px;font-weight:800;color:${bikeColor};line-height:1;">${bikes}</div>
              <div style="font-size:10px;color:${isDark ? '#8892a8' : '#94a3b8'};margin-top:1px;">disponibles</div>
            </div>
            <div style="flex:1;background:${isDark ? '#1b1f28' : '#f8fafc'};border-radius:10px;padding:8px 10px;border:1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e8ecf3'};">
              <div style="font-size:10px;color:${isDark ? '#8892a8' : '#94a3b8'};font-weight:500;margin-bottom:3px;text-transform:uppercase;letter-spacing:.4px;">Places</div>
              <div style="font-size:20px;font-weight:800;color:${dockColor};line-height:1;">${docks}</div>
              <div style="font-size:10px;color:${isDark ? '#8892a8' : '#94a3b8'};margin-top:1px;">libres</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;height:5px;background:${isDark ? 'rgba(255,255,255,0.08)' : '#e8ecf3'};border-radius:99px;overflow:hidden;">
              <div style="height:100%;width:${bikePercent}%;background:${bikeColor};border-radius:99px;"></div>
            </div>
            <span style="font-size:10px;color:${isDark ? '#8892a8' : '#94a3b8'};font-weight:600;flex-shrink:0;">${bikePercent}%</span>
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

    const content = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:0;min-width:200px;">
      <div style="background:linear-gradient(135deg,#00b7cc,#0099ad);padding:10px 30px 10px 14px;">
        <span style="color:white;font-size:13px;font-weight:700;line-height:1.3;">${incident.short_description}</span>
      </div>
      <div style="padding:7px 14px;background:${isDark ? '#21252f' : 'white'};">
        <span style="font-size:11px;color:${isDark ? '#8892a8' : '#94a3b8'};font-weight:500;">${incident.location.location_description}</span>
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
    icon: markerIcon(icons.busIcon)
  })

  const content = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:0;min-width:160px;">
    <div style="background:linear-gradient(135deg,#00b7cc,#0099ad);padding:10px 30px 10px 14px;">
      <span style="color:white;font-size:13px;font-weight:700;line-height:1.3;">${stop.stop_name}</span>
    </div>
    <div style="padding:7px 14px;background:${isDark ? '#21252f' : 'white'};">
      <span style="font-size:11px;color:${isDark ? '#8892a8' : '#94a3b8'};font-weight:500;">Arrêt sélectionné</span>
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
  routePolylines.value.forEach((p) => p.setMap(null))
  routePolylines.value = []
  routeStopMarkers.value.forEach((m) => m.setMap(null))
  routeStopMarkers.value = []
}

async function fetchShapePoints(routeId: string, directionId: string | number) {
  const res = await fetch(
    `${API_BASE}/api/routes/${encodeURIComponent(routeId)}/directions/${encodeURIComponent(String(directionId))}/shape`
  )
  const data = await res.json()
  return (data.points || []) as [number, number][]
}

watch(
  () => [props.selectedRouteId, props.selectedDirectionId, props.selectedRouteColor],
  async ([routeId, directionId, color]) => {
    if (!map.value) return
    const lineColor = (color as string) || '#2563eb'

    clearRouteLayers()
    if (!routeId) return

    try {
      async function drawDirection(dId: string | number, idx: number, showStops: boolean) {
        const [shapePoints, stopsData] = await Promise.all([
          fetchShapePoints(routeId as string, dId),
          fetch(
            `${API_BASE}/api/routes/${encodeURIComponent(routeId as string)}/directions/${encodeURIComponent(String(dId))}/stops`
          ).then((r) => r.json())
        ])

        const stops: { lat: number; lon: number; stopName: string }[] = stopsData.stops || []
        const validStops = stops.filter((s) => !Number.isNaN(s.lat) && !Number.isNaN(s.lon))
        const linePoints: [number, number][] =
          shapePoints.length > 0
            ? shapePoints
            : validStops.map((s): [number, number] => [s.lat, s.lon])

        if (linePoints.length > 1) {
          const polyline = new google.maps.Polyline({
            path: linePoints.map(([lat, lng]) => ({ lat, lng })),
            strokeColor: lineColor,
            strokeWeight: 5,
            strokeOpacity: idx === 0 ? 0.85 : 0.55,
            map: map.value!
          })
          routePolylines.value.push(polyline)
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

            const content = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:0;min-width:160px;">
              <div style="background:linear-gradient(135deg,${lineColor},${lineColor}cc);padding:10px 30px 10px 14px;">
                <span style="color:white;font-size:13px;font-weight:700;line-height:1.3;">${stop.stopName}</span>
              </div>
              <div style="padding:7px 14px;background:${isDark ? '#21252f' : 'white'};">
                <span style="font-size:11px;color:${isDark ? '#8892a8' : '#94a3b8'};font-weight:500;">Arrêt</span>
              </div>
            </div>`

            stopMk.addListener('click', () => openInfoWindow(stopMk, content))
            routeStopMarkers.value.push(stopMk)
          }
        }
      }

      if (directionId) {
        await drawDirection(directionId as string, 0, true)
      } else {
        const directionsRes = await fetch(
          `${API_BASE}/api/routes/${encodeURIComponent(routeId as string)}/directions`
        )
        const directionsData: { directionId: number | string }[] = await directionsRes.json()
        await Promise.all(
          (directionsData || []).map((d, idx) => drawDirection(d.directionId, idx, false))
        )
      }

      // Ajuster la vue sur la ligne tracée
      if (routePolylines.value.length > 0 || routeStopMarkers.value.length > 0) {
        const bounds = new google.maps.LatLngBounds()
        routePolylines.value.forEach((p) => p.getPath().forEach((pt) => bounds.extend(pt)))
        routeStopMarkers.value.forEach((m) => {
          const pos = m.getPosition()
          if (pos) bounds.extend(pos)
        })
        if (!bounds.isEmpty()) map.value!.fitBounds(bounds, 30)
      }
    } catch {
      // Shape non disponible — silencieux
    }
  }
)

// ── Changement de thème ────────────────────────────────────────────────────

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

  // Charge les trois bibliothèques nécessaires en parallèle
  await Promise.all([
    importLibrary('maps'), // Map, InfoWindow, Polyline, SymbolPath
    importLibrary('core'), // LatLngBounds, Size, Point
    importLibrary('marker') // Marker (legacy)
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

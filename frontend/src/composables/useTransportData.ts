import { ref, computed, watch } from 'vue'
import type { Stop, RouteInfo, Direction, Arrival, MergedArrival } from '@/types/types'
import { API_BASE } from '@/config/api'

const API = `${API_BASE}/api`

/**
 * Logique de récupération des données transport :
 * arrêts → lignes → directions → passages (temps réel + théoriques fusionnés).
 *
 */
export function useTransportData() {
  const allStops = ref<Stop[]>([])
  const stopGroups = ref<Map<string, string[]>>(new Map())
  const routes = ref<RouteInfo[]>([])
  const directions = ref<Direction[]>([])
  const arrivals = ref<{ realtime: Arrival[]; theoretical: Arrival[] }>({
    realtime: [],
    theoretical: []
  })

  const mergedArrivals = ref<MergedArrival[]>([])
  const routeToStopIds = ref<Map<string, string[]>>(new Map())

  const selectedStopName = ref('')
  const selectedRoute = ref('')
  const selectedDirection = ref('')
  const selectedRouteColor = ref('')
  const resultStopName = ref('')
  const directionName = ref('')

  const loadingStops = ref(true)
  const loadingRoutes = ref(false)
  const loadingDirections = ref(false)
  const loadingArrivals = ref(false)
  const error = ref('')

  const uniqueStopNames = computed(() =>
    Array.from(stopGroups.value.keys()).sort((a, b) => a.localeCompare(b, 'fr'))
  )

  const selectedRouteName = computed(() => {
    const r = routes.value.find((r) => r.route_id === selectedRoute.value)
    return r ? `${r.route_short_name} — ${r.route_long_name}` : ''
  })

  // ── Chargement initial des arrêts ──────────────────────────────────────────

  async function fetchStops() {
    loadingStops.value = true
    try {
      const res = await fetch(`${API}/stops`)
      const data: Stop[] = await res.json()
      allStops.value = data
      const groups = new Map<string, string[]>()
      for (const s of data) {
        if (s.location_type === '1') continue
        const name = s.stop_name
        if (!groups.has(name)) groups.set(name, [])
        groups.get(name)!.push(s.stop_id)
      }
      stopGroups.value = groups
    } catch {
      error.value = 'Impossible de charger les arrêts'
    } finally {
      loadingStops.value = false
    }
  }

  // ── Sélection arrêt → chargement des lignes ────────────────────────────────

  watch(selectedStopName, async (name) => {
    selectedRoute.value = ''
    selectedDirection.value = ''
    routes.value = []
    directions.value = []
    arrivals.value = { realtime: [], theoretical: [] }
    routeToStopIds.value = new Map()
    if (!name) return

    const stopIds = stopGroups.value.get(name) || []
    if (stopIds.length === 0) return

    loadingRoutes.value = true
    error.value = ''
    try {
      const allRoutesMap = new Map<string, RouteInfo>()
      const routeStopMap = new Map<string, string[]>()
      const results = await Promise.all(
        stopIds.map(async (sid) => {
          const res = await fetch(`${API}/stops/${encodeURIComponent(sid)}/routes`)
          const data: RouteInfo[] = await res.json()
          return { stopId: sid, routes: data }
        })
      )
      for (const { stopId, routes: rts } of results) {
        for (const r of rts) {
          allRoutesMap.set(r.route_id, r)
          if (!routeStopMap.has(r.route_id)) routeStopMap.set(r.route_id, [])
          routeStopMap.get(r.route_id)!.push(stopId)
        }
      }
      routes.value = Array.from(allRoutesMap.values())
      routeToStopIds.value = routeStopMap
    } catch {
      error.value = 'Impossible de charger les lignes'
    } finally {
      loadingRoutes.value = false
    }
  })

  // ── Sélection ligne → chargement des directions ────────────────────────────

  watch(selectedRoute, async (routeId) => {
    selectedDirection.value = ''
    directions.value = []
    directionName.value = ''
    arrivals.value = { realtime: [], theoretical: [] }

    const route = routes.value.find((r) => r.route_id === routeId)
    selectedRouteColor.value = route?.route_color ? `#${route.route_color}` : ''

    if (!routeId) return

    const stopIds = routeToStopIds.value.get(routeId) || []
    if (stopIds.length === 0) return

    loadingDirections.value = true
    error.value = ''
    try {
      const allDirectionsMap = new Map<string, Direction>()
      const results = await Promise.all(
        stopIds.map(async (sid) => {
          const res = await fetch(
            `${API}/stops/${encodeURIComponent(sid)}/routes/${encodeURIComponent(routeId)}/directions`
          )
          const data: Array<{ directionId: number; label: string }> = await res.json()
          return { stopId: sid, directions: data }
        })
      )
      for (const { stopId, directions: dirs } of results) {
        for (const d of dirs) {
          const key = `${d.directionId}|${d.label}`
          if (!allDirectionsMap.has(key)) allDirectionsMap.set(key, { ...d, stopId, routeId })
        }
      }
      directions.value = Array.from(allDirectionsMap.values())
    } catch {
      error.value = 'Impossible de charger les directions'
    } finally {
      loadingDirections.value = false
    }
  })

  // ── Sélection direction → chargement des passages ─────────────────────────

  watch(selectedDirection, async (value) => {
    arrivals.value = { realtime: [], theoretical: [] }
    if (!value || !selectedRoute.value) return
    await fetchArrivals()
  })

  async function fetchArrivals() {
    loadingArrivals.value = true
    error.value = ''
    try {
      const parts = selectedDirection.value.split('|')
      const stopId = parts[0]
      const directionId = parts[1]
      if (!stopId || !directionId) return

      const res = await fetch(
        `${API}/stops/${encodeURIComponent(stopId)}/routes/${encodeURIComponent(
          selectedRoute.value
        )}/directions/${encodeURIComponent(directionId)}/all-arrivals`
      )
      const data = await res.json()
      resultStopName.value = data.stopName || selectedStopName.value
      directionName.value = data.directionName || ''
      arrivals.value = {
        realtime: data.realtime || [],
        theoretical: data.theoretical || []
      }
      buildMergedArrivals()
    } catch {
      error.value = 'Impossible de charger les horaires'
    } finally {
      loadingArrivals.value = false
    }
  }

  // ── Fusion temps réel + théorique ─────────────────────────────────────────

  function buildMergedArrivals() {
    const theoreticalByTrip = new Map<string, Arrival>()
    for (const t of arrivals.value.theoretical) {
      theoreticalByTrip.set(t.tripId, t)
    }

    const result: MergedArrival[] = []
    const usedTheoreticalTripIds = new Set<string>()

    for (const rt of arrivals.value.realtime) {
      let th = theoreticalByTrip.get(rt.tripId)

      if (!th) {
        let minDiff = Infinity
        for (const t of arrivals.value.theoretical) {
          if (usedTheoreticalTripIds.has(t.tripId)) continue
          const diff = Math.abs(rt.arrivalInMin - t.arrivalInMin)
          if (diff < minDiff && diff <= 5) {
            minDiff = diff
            th = t
          }
        }
      }

      if (th) usedTheoreticalTripIds.add(th.tripId)

      result.push({
        tripId: rt.tripId,
        realtimeMin: rt.arrivalInMin,
        theoreticalMin: th ? th.arrivalInMin : null,
        theoreticalTime: th ? (th.arrivalTime ?? null) : null,
        delay: th ? rt.arrivalInMin - th.arrivalInMin : null
      })
    }

    for (const th of arrivals.value.theoretical) {
      if (!usedTheoreticalTripIds.has(th.tripId)) {
        result.push({
          tripId: th.tripId,
          realtimeMin: null,
          theoreticalMin: th.arrivalInMin,
          theoreticalTime: th.arrivalTime ?? null,
          delay: null
        })
      }
    }

    result.sort((a, b) => {
      const aMin = a.realtimeMin ?? a.theoreticalMin ?? 999
      const bMin = b.realtimeMin ?? b.theoreticalMin ?? 999
      return aMin - bMin
    })

    mergedArrivals.value = result.slice(0, 3)
  }

  function refreshArrivals() {
    if (selectedDirection.value && selectedRoute.value) fetchArrivals()
  }

  return {
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
    refreshArrivals
  }
}

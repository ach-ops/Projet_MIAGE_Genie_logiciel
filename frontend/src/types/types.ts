// Types pour les incidents/travaux
type IncidentLocation = {
  street: string
  polyline: string
  location_description: string
}

type IncidentSource = {
  name: string
  reference: string
}

export type Incident = {
  type: string
  description: string
  short_description: string
  starttime: string
  endtime: string
  location: IncidentLocation
  source: IncidentSource
  updatetime: string
  creationtime: string
  id: string
}

// Types pour les transports
export type Stop = {
  stop_id: string
  stop_name: string
  stop_lat: string
  stop_lon: string
  location_type?: string
  parent_station?: string
}

export type RouteInfo = {
  route_id: string
  route_short_name: string
  route_long_name: string
  route_color?: string
  route_text_color?: string
}

export type Direction = {
  directionId: number
  label: string
  stopId: string
  routeId: string
}

export type Arrival = {
  stopId: string
  routeId: string
  tripId: string
  directionId: number
  arrivalTimestamp?: number
  arrivalTime?: string
  arrivalLocalTime?: string
  arrivalInMin: number
}

// Résultat de la fusion temps réel + théorique dans useTransportData
export type MergedArrival = {
  tripId: string
  realtimeMin: number | null
  theoreticalMin: number | null
  theoreticalTime: string | null
  delay: number | null // positif = retard, négatif = avance, null = pas de comparaison possible
}

// ─── Itinéraire ───────────────────────────────────────────────────────────────

export type WalkLeg = {
  type: 'walk'
  from: { lat: number; lon: number; name?: string; stopId?: string; stopName?: string }
  to: { lat: number; lon: number; name?: string; stopId?: string; stopName?: string }
  distanceKm: number
  durationMin: number
}

export type BusLeg = {
  type: 'bus'
  route: { routeId: string; routeShortName: string; color: string; direction: string }
  from: { stopId: string; stopName: string }
  to: { stopId: string; stopName: string }
  stopCount: number
  durationMin: number
}

export type ItineraryLeg = WalkLeg | BusLeg

export type ItineraryOption = {
  totalDurationMin: number
  legs: ItineraryLeg[]
}

export type ItineraryResult = {
  from: { address: string; displayName: string; lat: number; lon: number }
  to: { address: string; displayName: string; lat: number; lon: number }
  walkingOnly: { type: 'walking'; distanceKm: number; durationMin: number }
  options: ItineraryOption[]
}

// ─── Navigation ────────────────────────────────────────────────────────────────

export type HeaderTab = 'itineraires' | 'horaires' | 'trajet'

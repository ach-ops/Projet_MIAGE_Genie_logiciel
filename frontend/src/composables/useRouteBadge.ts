import type { RouteInfo } from '@/types/types'

/**
 * Partagé entre RouteSelector (horaires) et RouteTracer (tracé carte).
 */
export function useRouteBadge() {
  function badgeStyle(route: RouteInfo) {
    return {
      backgroundColor: route.route_color ? `#${route.route_color}` : '#004650',
      color: route.route_text_color ? `#${route.route_text_color}` : '#ffffff'
    }
  }

  function formatLabel(name: string): string {
    return name.includes(' ') ? name.replace(' ', '\n') : name
  }

  /** Trams (T) en premier, puis tri alphanumérique */
  function sortByType(routes: RouteInfo[]): RouteInfo[] {
    return [...routes].sort((a, b) => {
      const aT = a.route_short_name.startsWith('T')
      const bT = b.route_short_name.startsWith('T')
      if (aT && !bT) return -1
      if (!aT && bT) return 1
      return a.route_short_name.localeCompare(b.route_short_name, 'fr', { numeric: true })
    })
  }

  /** Tri numérique simple (utilisé au chargement initial dans RouteTracer) */
  function sortByNumber(routes: RouteInfo[]): RouteInfo[] {
    return [...routes].sort((a, b) => {
      const na = parseInt(a.route_short_name) || 0
      const nb = parseInt(b.route_short_name) || 0
      return na !== nb ? na - nb : a.route_short_name.localeCompare(b.route_short_name, 'fr')
    })
  }

  return { badgeStyle, formatLabel, sortByType, sortByNumber }
}

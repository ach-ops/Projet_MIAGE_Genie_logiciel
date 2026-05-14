import { ref } from 'vue'
import { API_BASE } from '@/config/api'

export type AddressSuggestion = {
  label:       string
  displayName: string
  lat:         number
  lon:         number
}

/**
 * Autocomplétion d'adresse via le proxy backend (Nominatim).
 *
 * Utilisation :
 *   const ac = useAddressAutocomplete()
 *   ac.query('place Stan')          → déclenche une recherche debouncée
 *   ac.suggestions.value            → liste de suggestions
 *   ac.select(suggestion)           → retourne le label choisi et vide les suggestions
 *   ac.clear()                      → vide les suggestions sans sélectionner
 */
export function useAddressAutocomplete() {
  const suggestions = ref<AddressSuggestion[]>([])
  const loading     = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null

  function query(value: string) {
    if (timer) clearTimeout(timer)
    suggestions.value = []

    if (!value || value.length < 3) return

    timer = setTimeout(async () => {
      loading.value = true
      try {
        const res  = await fetch(`${API_BASE}/api/itinerary/suggest?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        suggestions.value = Array.isArray(data) ? data : []
      } catch {
        suggestions.value = []
      } finally {
        loading.value = false
      }
    }, 320)
  }

  function select(s: AddressSuggestion): string {
    suggestions.value = []
    if (timer) clearTimeout(timer)
    return s.label
  }

  function clear() {
    suggestions.value = []
    if (timer) clearTimeout(timer)
    loading.value = false
  }

  return { suggestions, loading, query, select, clear }
}

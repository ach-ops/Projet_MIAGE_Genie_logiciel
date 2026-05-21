import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ItineraryResult } from '@/types/types'
import { API_BASE } from '@/config/api'

export const useItineraryStore = defineStore('itinerary', () => {
  const fromAddress = ref('')
  const toAddress = ref('')
  const loading = ref(false)
  const error = ref('')
  const result = ref<ItineraryResult | null>(null)

  async function search() {
    const from = fromAddress.value.trim()
    const to = toAddress.value.trim()
    if (!from || !to) return

    // Vérification côté client pour éviter un appel API inutile
    if (from.toLowerCase() === to.toLowerCase()) {
      error.value = "Le départ et l'arrivée sont identiques."
      result.value = null
      return
    }

    loading.value = true
    error.value = ''
    result.value = null

    try {
      const res = await fetch(
        `${API_BASE}/api/itinerary?from=${encodeURIComponent(fromAddress.value.trim())}&to=${encodeURIComponent(toAddress.value.trim())}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erreur lors du calcul de l'itinéraire")
      result.value = data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur inconnue'
    } finally {
      loading.value = false
    }
  }

  function swap() {
    // Échange départ-arrivée et efface le résultat précédent
    const tmp = fromAddress.value
    fromAddress.value = toAddress.value
    toAddress.value = tmp
    result.value = null
    error.value = ''
  }

  function reset() {
    fromAddress.value = ''
    toAddress.value = ''
    result.value = null
    error.value = ''
  }

  return { fromAddress, toAddress, loading, error, result, search, swap, reset }
})

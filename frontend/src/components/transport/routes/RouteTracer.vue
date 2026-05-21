<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { Bus, Navigation, ArrowLeftRight, ArrowRight, AlertCircle } from 'lucide-vue-next'
import type { RouteInfo, Direction } from '@/types/types'
import { useTheme } from '@/composables/useTheme'
import { useRouteBadge } from '@/composables/useRouteBadge'
import { API_BASE } from '@/config/api'

const { theme } = useTheme()
const { badgeStyle, formatLabel, sortByType, sortByNumber } = useRouteBadge()

const API = `${API_BASE}/api`

const emit = defineEmits<{
  'update:selectedRouteId': [value: string]
  'update:selectedDirectionId': [value: string]
  'update:selectedRouteColor': [value: string]
}>()

const allRoutes = ref<RouteInfo[]>([])
const directions = ref<Direction[]>([])
const selectedRoute = ref('')
const selectedDirection = ref('')
const loadingRoutes = ref(true)
const loadingDirections = ref(false)
const error = ref('')

const sortedRoutes = computed(() => sortByType(allRoutes.value))

const selectedRouteColor = computed(() => {
  const route = allRoutes.value.find((r) => r.route_id === selectedRoute.value)
  return route?.route_color ? `#${route.route_color}` : '#004650'
})

const selectedRouteInfo = computed(() =>
  allRoutes.value.find((r) => r.route_id === selectedRoute.value) ?? null,
)

onMounted(async () => {
  try {
    const res = await fetch(`${API}/routes`)
    const data: RouteInfo[] = await res.json()
    allRoutes.value = sortByNumber(data)
  } catch {
    error.value = 'Impossible de charger les lignes'
  } finally {
    loadingRoutes.value = false
  }
})

watch(selectedRoute, async (routeId) => {
  // Réinitialise la direction et notifie la carte immédiatement pour changer la couleur du tracé
  selectedDirection.value = ''
  directions.value = []
  emit('update:selectedRouteId', routeId)
  emit('update:selectedDirectionId', '')
  emit('update:selectedRouteColor', selectedRouteColor.value)
  if (!routeId) return

  loadingDirections.value = true
  try {
    const res = await fetch(`${API}/routes/${encodeURIComponent(routeId)}/directions`)
    const data: Array<{ directionId: number; label: string }> = await res.json()
    directions.value = data.map((d) => ({ ...d, stopId: '', routeId }))
  } catch {
    error.value = 'Impossible de charger les directions'
  } finally {
    loadingDirections.value = false
  }
})

watch(selectedDirection, (directionId) => {
  emit('update:selectedDirectionId', directionId)
})

function selectDirection(directionId: string) {
  selectedDirection.value = directionId
}

// Efface la sélection et demande à la carte de masquer le tracé
function resetSelection() {
  selectedRoute.value = ''
  selectedDirection.value = ''
  directions.value = []
  emit('update:selectedRouteId', '')
  emit('update:selectedDirectionId', '')
  emit('update:selectedRouteColor', '')
}
</script>

<template>
  <div class="space-y-4">
    <!-- Sélecteur de ligne -->
    <div>
      <p
        class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2"
      >
        <Bus class="w-3.5 h-3.5 text-[#00b7cc]" />
        Choisir une ligne
      </p>

      <!-- Skeleton -->
      <div
        v-if="loadingRoutes"
        class="grid gap-[6px]"
        style="grid-template-columns: repeat(auto-fill, minmax(44px, 1fr))"
      >
        <div
          v-for="i in 10"
          :key="i"
          class="h-[28px] rounded-[6px] bg-slate-100 dk-dim animate-pulse"
        ></div>
      </div>

      <!-- Grille de badges -->
      <div
        v-else
        class="grid gap-[6px]"
        style="grid-template-columns: repeat(auto-fill, minmax(44px, 1fr))"
      >
        <button
          v-for="route in sortedRoutes"
          :key="route.route_id"
          type="button"
          class="relative transition active:scale-[0.95]"
          :title="`${route.route_short_name} — ${route.route_long_name}`"
          @click="selectedRoute = route.route_id"
        >
          <div
            class="w-full h-[28px] flex items-center justify-center rounded-[6px] px-[4px] overflow-hidden"
            :style="badgeStyle(route)"
          >
            <span
              class="font-bold text-center leading-[10px]"
              :class="route.route_short_name.length > 4 ? 'text-[8px] whitespace-normal' : 'text-[14px] whitespace-nowrap'"
              >{{ formatLabel(route.route_short_name) }}</span
            >
          </div>
          <div
            v-if="selectedRoute === route.route_id"
            class="absolute -inset-[2px] border border-black dark:border-white rounded-[6px]"
          ></div>
        </button>
      </div>
    </div>

    <!-- Sélecteur de direction -->
    <div v-if="selectedRoute">
      <p
        class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2"
      >
        <Navigation class="w-3.5 h-3.5 text-[#00b7cc]" />
        Direction
      </p>

      <div v-if="loadingDirections" class="flex flex-col gap-2">
        <div
          v-for="i in 3"
          :key="i"
          class="h-11 rounded-xl bg-slate-100 dk-dim animate-pulse"
        ></div>
      </div>

      <div v-else class="flex flex-col gap-1.5">
        <!-- Tous les sens -->
        <button
          type="button"
          class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-[13px] font-semibold transition-all duration-150 text-left"
          :class="selectedDirection === '' ? 'text-white border-transparent' : 'hover:border-slate-300'"
          :style="
            selectedDirection === ''
              ? { backgroundColor: selectedRouteColor, borderColor: selectedRouteColor }
              : {
                  background: theme === 'dark' ? 'var(--dk-card)' : 'white',
                  borderColor: theme === 'dark' ? 'var(--dk-border)' : '#e8ecf3',
                  color: theme === 'dark' ? 'var(--dk-text-2)' : '',
                }
          "
          @click="selectDirection('')"
        >
          <ArrowLeftRight
            class="w-[13px] h-[13px] shrink-0"
            :class="selectedDirection === '' ? 'text-white/80' : 'text-slate-400'"
          />
          <span class="truncate">Tous les sens</span>
        </button>

        <!-- Direction individuelle -->
        <button
          v-for="d in directions"
          :key="`${d.directionId}-${d.label}`"
          type="button"
          class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-[13px] font-semibold transition-all duration-150 text-left"
          :class="selectedDirection === String(d.directionId) ? 'text-white border-transparent' : 'hover:border-slate-300'"
          :style="
            selectedDirection === String(d.directionId)
              ? { backgroundColor: selectedRouteColor, borderColor: selectedRouteColor }
              : {
                  background: theme === 'dark' ? 'var(--dk-card)' : 'white',
                  borderColor: theme === 'dark' ? 'var(--dk-border)' : '#e8ecf3',
                  color: theme === 'dark' ? 'var(--dk-text-1)' : '',
                }
          "
          @click="selectDirection(String(d.directionId))"
        >
          <ArrowRight
            class="w-[13px] h-[13px] shrink-0"
            :class="selectedDirection === String(d.directionId) ? 'text-white/80' : 'text-slate-400'"
          />
          <span class="truncate">{{ d.label }}</span>
        </button>
      </div>
    </div>

    <!-- Info tracé actif -->
    <Transition name="fade">
      <div
        v-if="selectedRoute"
        class="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl"
        :style="{
          backgroundColor: `${selectedRouteColor}18`,
          borderColor: `${selectedRouteColor}40`,
          borderWidth: '1px',
          borderStyle: 'solid',
        }"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span
            class="shrink-0 h-6 min-w-[24px] max-w-[56px] px-1.5 rounded-md font-bold flex items-center justify-center text-center leading-none overflow-hidden"
            :style="{
              backgroundColor: selectedRouteInfo?.route_color
                ? `#${selectedRouteInfo.route_color}`
                : '#004650',
              color: selectedRouteInfo?.route_text_color
                ? `#${selectedRouteInfo.route_text_color}`
                : '#fff',
              fontSize: (selectedRouteInfo?.route_short_name?.length ?? 0) > 5 ? '9px' : '12px',
            }"
          >
            {{ selectedRouteInfo?.route_short_name }}
          </span>
          <span class="text-[12px] font-medium text-slate-600 dark:text-slate-300 truncate">
            Tracé affiché sur la carte
          </span>
        </div>
        <button
          class="shrink-0 text-[11px] font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          @click="resetSelection"
        >
          Réinitialiser
        </button>
      </div>
    </Transition>

    <!-- Erreur -->
    <div
      v-if="error"
      class="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-xl text-[13px]"
    >
      <AlertCircle class="w-4 h-4 shrink-0" />
      {{ error }}
    </div>
  </div>
</template>

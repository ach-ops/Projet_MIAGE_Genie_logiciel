<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RouteInfo } from '@/types/types'
import { useRouteBadge } from '@/composables/useRouteBadge'

const props = defineProps<{
  routes: RouteInfo[]
  loading: boolean
  show: boolean
}>()

const emit = defineEmits<{
  'update:selectedRoute': [value: string]
}>()

const { badgeStyle, formatLabel, sortByType } = useRouteBadge()

const selectedRoute = ref('')

const sortedRoutes = computed(() => sortByType(props.routes))

function selectRoute(route: RouteInfo) {
  selectedRoute.value = route.route_id
  emit('update:selectedRoute', route.route_id)
}

watch(
  () => props.routes,
  () => {
    selectedRoute.value = ''
  },
)
</script>

<template>
  <div v-if="show">
    <!-- Skeletons chargement -->
    <div v-if="loading" class="flex flex-wrap gap-1.5">
      <div
        v-for="i in 8"
        :key="i"
        class="h-[28px] w-[44px] rounded-[6px] bg-slate-100 dk-dim animate-pulse"
      ></div>
    </div>

    <!-- Badges lignes -->
    <div v-else-if="sortedRoutes.length > 0">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="route in sortedRoutes"
          :key="route.route_id"
          type="button"
          class="relative transition active:scale-[0.95]"
          :title="`${route.route_short_name} — ${route.route_long_name}`"
          @click="selectRoute(route)"
        >
          <div
            class="w-[44px] h-[28px] flex items-center justify-center rounded-[6px] px-[4px] overflow-hidden"
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

    <div v-else class="text-[13px] text-slate-400 dark:text-slate-500 italic py-1">
      Aucune ligne disponible
    </div>
  </div>
</template>

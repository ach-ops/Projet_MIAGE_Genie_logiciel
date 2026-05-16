<script setup lang="ts">
import { ref } from 'vue'
import { SlidersHorizontal } from 'lucide-vue-next'
import '../style.css'
import MapComponent from '../components/map/MapComponent.vue'
import WeatherComponent from '../components/weather/WeatherComponent.vue'
import NewsTicker from '../components/ui/NewsTicker.vue'
import LeftView from '../components/layout/LeftView.vue'
import type { Stop } from '@/types/types'
import { useTheme } from '@/composables/useTheme'

const { theme } = useTheme()

const selectedStopName = ref('')
const allStops = ref<Stop[]>([])
const selectedRouteId = ref('')
const selectedDirectionId = ref('')
const selectedRouteColor = ref('')
const panelOpen = ref(false)
</script>

<template>
  <div
    class="flex h-[100dvh] overflow-hidden transition-colors duration-200 safe-left safe-right"
    :style="theme === 'dark'
      ? { background: 'var(--dk-bg)' }
      : { background: 'radial-gradient(ellipse at 10% 0%, #c7e8f0 0%, transparent 55%), radial-gradient(ellipse at 90% 100%, #ccd7f0 0%, transparent 55%), #dde6f2' }"
  >
    <!-- Mobile -->
    <Transition name="fade">
      <div
        v-if="panelOpen"
        class="fixed inset-0 z-[750] bg-black/50 md:hidden"
        @click="panelOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      class="shrink-0 w-[min(340px,92vw)] md:w-[400px] lg:w-[460px] h-full z-[800] md:z-40
             fixed md:relative
             transition-transform duration-300 ease-out
             shadow-[4px_0_24px_rgba(0,0,0,0.12)] md:shadow-none"
      :class="panelOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
    >
      <LeftView
        @update:selected-stop-name="selectedStopName = $event"
        @update:all-stops="allStops = $event"
        @update:selected-route-id="selectedRouteId = $event"
        @update:selected-direction-id="selectedDirectionId = $event"
        @update:selected-route-color="selectedRouteColor = $event"
      />
    </aside>

    <!-- Main area -->
    <div
      class="flex-1 flex flex-col min-w-0 h-full px-2 sm:px-3 pb-2 sm:pb-3 pt-3 sm:pt-4 gap-2 sm:gap-3 safe-top safe-bottom"
    >
      <!-- Barre mobile : bouton menu + titre -->
      <div class="shrink-0 flex items-center gap-2 md:hidden relative z-10">
        <button
          class="w-11 h-11 flex items-center justify-center rounded-xl shadow-md active:scale-95 transition-all duration-200 shrink-0"
          :class="theme === 'dark' ? 'bg-[#0099ad] text-white shadow-[0_2px_12px_rgba(0,153,173,0.45)]' : 'bg-white text-slate-700'"
          @click="panelOpen = !panelOpen"
          aria-label="Ouvrir le panneau"
        >
          <SlidersHorizontal class="w-5 h-5" />
        </button>
        <div class="flex-1 min-w-0">
          <NewsTicker />
        </div>
      </div>

      <!-- Weather strip -->
      <div class="shrink-0 mt-2 md:mt-3">
        <WeatherComponent />
      </div>

      <!-- Bande défilante -->
      <div class="shrink-0 hidden md:block">
        <NewsTicker />
      </div>

      <!-- Map -->
      <div
        class="flex-1 min-h-0 rounded-xl sm:rounded-2xl overflow-hidden relative transition-shadow duration-200 mb-2 md:mb-3"
        :class="theme === 'dark' ? 'shadow-[0_8px_32px_rgba(0,0,0,0.4)] ring-1 ring-slate-700/60' : 'shadow-[0_8px_32px_rgba(0,80,120,0.14)] ring-1 ring-white/40'"
      >
        <MapComponent
          :selected-stop-name="selectedStopName"
          :all-stops="allStops"
          :selected-route-id="selectedRouteId"
          :selected-direction-id="selectedDirectionId"
          :selected-route-color="selectedRouteColor"
        />
      </div>
    </div>
  </div>
</template>

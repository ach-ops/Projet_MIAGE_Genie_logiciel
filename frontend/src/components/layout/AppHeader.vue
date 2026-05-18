<script setup lang="ts">
import { Sun, Moon, Clock, Route, Timer, Navigation } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { useDelayFormat } from '@/composables/useDelayFormat'
import type { HeaderTab } from '@/types/types'

const props = defineProps<{
  averageDelay: number | null
  activeTab: HeaderTab
}>()

const emit = defineEmits<{
  'tab-change': [tab: HeaderTab]
  'toggle-theme': []
}>()

const { theme } = useTheme()
const { fmtDelay, delayBadgeStyle } = useDelayFormat()

const tabs: Array<{ name: HeaderTab; label: string; icon: unknown }> = [
  { name: 'itineraires', label: 'Itinéraires', icon: Route },
  { name: 'horaires', label: 'Horaires', icon: Timer },
  { name: 'trajet', label: 'Mon trajet', icon: Navigation },
]
</script>

<template>
  <header
    class="shrink-0 relative overflow-hidden"
    :style="
      theme === 'dark'
        ? 'background: linear-gradient(135deg, #0a3a4a 0%, #0c2d3a 60%, #1b1f28 100%)'
        : 'background: linear-gradient(135deg, #0099ad 0%, #007a8e 60%, #006070 100%)'
    "
  >
    <!-- Cercles -->
    <div
      class="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
      style="background: rgba(255, 255, 255, 0.06)"
    ></div>
    <div
      class="absolute top-8 -right-4 w-20 h-20 rounded-full pointer-events-none"
      style="background: rgba(255, 255, 255, 0.04)"
    ></div>

    <!-- Branding + contrôles -->
    <div class="flex items-center justify-between px-4 pt-4 pb-3 relative">
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center font-black text-[15px] text-[#0099ad] bg-white shrink-0"
          style="box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18), 0 1px 3px rgba(0, 0, 0, 0.12)"
        >
          S
        </div>
        <div>
          <div class="text-white font-bold text-[14px] leading-tight tracking-tight">STAN</div>
          <div class="text-white/80 text-[10px] leading-tight">Réseau de Nancy</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-white/70 text-[11px] tabular-nums">
          {{
            new Date().toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })
          }}
        </span>
        <button
          class="w-7 h-7 flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 text-white transition-all active:scale-95"
          :aria-label="theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'"
          @click="emit('toggle-theme')"
        >
          <Sun v-if="theme === 'dark'" class="w-3.5 h-3.5" />
          <Moon v-else class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Badge retard moyen réseau -->
    <div
      v-if="props.averageDelay !== null"
      class="flex items-center gap-2 mx-3 mb-2 px-3 py-2 rounded-xl"
      :style="delayBadgeStyle(props.averageDelay!)"
    >
      <Clock class="w-3.5 h-3.5 shrink-0 text-white/90" />
      <span class="text-[12px] font-bold text-white tracking-wide">Retard moyen réseau</span>
      <span
        class="ml-auto text-[12px] font-black text-white"
        >{{ fmtDelay(props.averageDelay!) }}</span
      >
    </div>

    <!-- Barre d'onglets -->
    <div
      class="flex mx-3 mb-3"
      style="
        background: rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        padding: 4px;
        gap: 4px;
        backdrop-filter: blur(8px);
      "
    >
      <button
        v-for="tab in tabs"
        :key="tab.name"
        class="tab-btn flex flex-1 items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 text-[11px] sm:text-[12px] font-semibold transition-all duration-200 whitespace-nowrap"
        :class="props.activeTab === tab.name ? 'tab-btn--active' : ''"
        :style="
          props.activeTab === tab.name
            ? {
                background: theme === 'dark' ? 'var(--dk-hover)' : 'white',
                color: theme === 'dark' ? '#00b7cc' : '#0099ad',
                borderRadius: '9px',
                boxShadow:
                  theme === 'dark' ? '0 2px 8px rgba(0,0,0,0.25)' : '0 2px 8px rgba(0,0,0,0.12)',
              }
            : { color: 'rgba(255,255,255,0.65)', borderRadius: '9px' }
        "
        @click="emit('tab-change', tab.name)"
      >
        <component :is="tab.icon" class="w-4 h-4" />
        {{ tab.label }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.tab-btn:not(.tab-btn--active):hover {
  background: rgba(255, 255, 255, 0.18);
  color: white;
}
</style>

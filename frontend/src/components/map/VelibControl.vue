<script setup lang="ts">
import { Bike, RefreshCw } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

const { theme } = useTheme()

defineProps<{
  visible: boolean
  loading: boolean
  count: number
}>()

const emit = defineEmits<{
  toggle: []
  refresh: []
}>()
</script>

<template>
  <div class="absolute top-3 right-3 z-[700]">
    <div
      class="flex items-center gap-0 rounded-2xl border shadow-[0_4px_20px_rgba(2,8,20,0.12)] overflow-hidden transition-colors duration-200"
      :style="
        theme === 'dark'
          ? { background: 'var(--dk-surface)', borderColor: 'var(--dk-border)' }
          : { background: 'white', borderColor: '#e2e8f0' }
      "
    >
      <!-- Bouton toggle -->
      <button
        type="button"
        class="flex items-center gap-1.5 sm:gap-2.5 h-8 sm:h-10 pl-2 sm:pl-3 pr-2 sm:pr-4 text-[11px] sm:text-[12px] font-semibold transition-all duration-200 active:scale-95 focus-visible:outline-none"
        :class="
          visible
            ? 'text-[#007a8a] dark:text-[#00b7cc]'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        "
        @click="emit('toggle')"
      >
        <!-- Icône vélo avec point live -->
        <span
          class="relative flex items-center justify-center w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl transition-all duration-200"
          :class="visible ? 'bg-[#00b7cc]' : 'bg-slate-100'"
        >
          <Bike
            class="w-[11px] h-[11px] sm:w-[14px] sm:h-[14px] transition-colors duration-200"
            :class="visible ? 'text-white' : 'text-slate-400'"
          />
          <span
            v-if="visible"
            class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 border border-white sm:border-2"
          ></span>
        </span>

        <span class="leading-none">Vélib'</span>

        <!-- Compteur — masqué sur mobile -->
        <span
          class="hidden sm:inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-bold transition-all duration-200"
          :class="visible ? 'bg-[#00b7cc]/12 text-[#00b7cc]' : 'bg-slate-100 text-slate-400'"
        >
          {{ count }}
        </span>
      </button>

      <!-- Séparateur -->
      <div
        class="w-px h-4 sm:h-5 flex-shrink-0 transition-colors duration-200"
        :style="{ background: theme === 'dark' ? 'var(--dk-border)' : '#e2e8f0' }"
      ></div>

      <!-- Bouton rafraîchir -->
      <button
        type="button"
        class="flex items-center justify-center w-8 sm:w-10 h-8 sm:h-10 transition-all duration-200 active:scale-95 focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed text-slate-400 hover:text-[#00b7cc] dark:text-slate-500 dark:hover:text-[#00b7cc]"
        :disabled="loading"
        aria-label="Rafraichir les stations Vélib"
        @click="emit('refresh')"
      >
        <RefreshCw
          class="w-[12px] h-[12px] sm:w-[14px] sm:h-[14px]"
          :class="loading ? 'animate-spin text-[#00b7cc]' : ''"
        />
      </button>
    </div>
  </div>
</template>

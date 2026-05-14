<script setup lang="ts">
import { RefreshCw, ArrowRight, Clock, Zap } from 'lucide-vue-next'
import type { MergedArrival } from '@/types/types'

defineProps<{
  arrivals: MergedArrival[]
  loading: boolean
  show: boolean
  stopName: string
  directionName: string
  routeName: string
}>()

const emit = defineEmits<{ refresh: [] }>()

function displayMin(a: MergedArrival): number | null {
  return a.realtimeMin ?? a.theoreticalMin
}

function formatMin(min: number | null): string {
  if (min === null) return '—'
  if (min <= 0) return 'Imminent'
  if (min === 1) return '1 min'
  return `${min} min`
}

function delayLabel(delay: number | null): string {
  if (delay === null) return '—'
  if (delay === 0) return 'À l\'heure'
  return `${delay > 0 ? '+' : ''}${delay} min`
}

function delayClass(delay: number | null): string {
  if (delay === null) return 'text-slate-300 dark:text-slate-600'
  if (delay <= 0) return 'text-emerald-600 dark:text-emerald-400'
  if (delay <= 2) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

function delayDotClass(delay: number | null): string {
  if (delay === null) return 'bg-slate-200 dark:bg-slate-600'
  if (delay <= 0) return 'bg-emerald-500'
  if (delay <= 2) return 'bg-amber-500'
  return 'bg-red-500'
}
</script>

<template>
  <div v-if="show" class="rounded-2xl border border-[#e8ecf3] dark:border-slate-700 shadow-sm overflow-hidden dark:bg-slate-800">

    <!-- ── Titre + arrêt + refresh ── -->
    <div class="px-4 pt-3 pb-2.5 border-b border-[#f0f3f9] dark:border-slate-700">
      <div class="flex items-center justify-between mb-1.5">
        <span class="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          <Clock class="w-3 h-3 text-[#00b7cc]" />
          Prochains passages
        </span>
        <button
          class="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-[#00b7cc] active:scale-95 transition-all duration-150 disabled:opacity-40"
          :disabled="loading"
          aria-label="Actualiser"
          @click="emit('refresh')"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="loading ? 'animate-spin text-[#00b7cc]' : ''" />
        </button>
      </div>
      <h5 class="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{{ stopName }}</h5>
      <div v-if="directionName" class="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-[#f0fafe] dark:bg-[#00b7cc]/10 border border-[#00b7cc]/20">
        <ArrowRight class="w-3 h-3 text-[#00b7cc] shrink-0" />
        <span class="text-[11px] font-medium text-[#007a8a] dark:text-[#00b7cc] truncate max-w-[180px]">{{ directionName }}</span>
      </div>
    </div>

    <!-- ── Skeleton ── -->
    <div v-if="loading" class="p-4 space-y-3">
      <div v-for="i in 3" :key="i" class="flex items-center gap-3">
        <div class="h-7 w-16 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse"></div>
        <div class="h-4 w-20 bg-slate-100 dark:bg-slate-700 rounded animate-pulse"></div>
        <div class="ml-auto h-4 w-12 bg-slate-100 dark:bg-slate-700 rounded animate-pulse"></div>
      </div>
    </div>

    <!-- ── État vide ── -->
    <div v-else-if="arrivals.length === 0" class="px-4 py-8 flex flex-col items-center gap-2 text-center">
      <Clock class="w-7 h-7 text-slate-200 dark:text-slate-600" />
      <p class="text-[13px] text-slate-400 dark:text-slate-500">Aucun passage à venir</p>
    </div>

    <!-- ── Tableau ── -->
    <div v-else>

      <!-- En-têtes -->
      <div class="grid grid-cols-[2fr_2fr_1fr] gap-x-4 px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-[#e8ecf3] dark:border-slate-700">
        <div class="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          <Zap class="w-3 h-3 text-[#00b7cc]" />
          Temps réel
        </div>
        <div class="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          <Clock class="w-3 h-3 text-slate-300 dark:text-slate-600" />
          Théorique
        </div>
        <div class="flex items-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Retard
        </div>
      </div>

      <!-- Lignes -->
      <div class="divide-y divide-[#f0f3f9] dark:divide-slate-700/60">
        <div
          v-for="(arrival, i) in arrivals"
          :key="i"
          class="grid grid-cols-[2fr_2fr_1fr] gap-x-4 items-center px-4 py-3"
          :class="i === 0 ? 'bg-white dark:bg-slate-800' : 'bg-white/60 dark:bg-slate-800/40'"
        >

          <!-- Colonne 1 : Temps réel -->
          <div class="flex items-center gap-2">
            <span
              v-if="arrival.realtimeMin !== null"
              class="text-[16px] font-black tabular-nums"
              :class="displayMin(arrival)! <= 1 ? 'text-[#00b7cc]' : 'text-slate-800 dark:text-slate-100'"
            >
              {{ formatMin(arrival.realtimeMin) }}
            </span>
            <span v-else class="text-[13px] text-slate-300 dark:text-slate-600 tabular-nums">—</span>
          </div>

          <!-- Colonne 2 : Heure théorique -->
          <div class="flex flex-col">
            <span class="text-[13px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
              {{ arrival.theoreticalTime ?? '—' }}
            </span>
            <span
              v-if="arrival.theoreticalMin !== null"
              class="text-[10px] text-slate-300 dark:text-slate-600 tabular-nums"
            >
              {{ formatMin(arrival.theoreticalMin) }}
            </span>
          </div>

          <!-- Colonne 3 : Retard -->
          <div class="flex items-center gap-1 min-w-0">
            <span
              class="w-1.5 h-1.5 rounded-full shrink-0"
              :class="delayDotClass(arrival.delay)"
            ></span>
            <span
              class="text-[11px] font-bold tabular-nums whitespace-nowrap"
              :class="delayClass(arrival.delay)"
            >
              {{ delayLabel(arrival.delay) }}
            </span>
          </div>

        </div>
      </div>
    </div>

  </div>
</template>

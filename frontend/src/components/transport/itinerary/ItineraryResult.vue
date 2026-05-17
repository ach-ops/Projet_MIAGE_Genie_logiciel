<script setup lang="ts">
import { Footprints, Bus, Clock, MapPin, AlertCircle, ChevronDown, ChevronUp, ArrowRight, ArrowLeftRight } from 'lucide-vue-next'
import { ref } from 'vue'
import { useItineraryStore } from '@/stores/itinerary'
import { useTheme } from '@/composables/useTheme'
import type { WalkLeg, BusLeg } from '@/types/types'

const store     = useItineraryStore()
const { theme } = useTheme()
const expandedIndex = ref<number | null>(0)

function toggle(i: number) {
  expandedIndex.value = expandedIndex.value === i ? null : i
}
function isWalk(leg: WalkLeg | BusLeg): leg is WalkLeg { return leg.type === 'walk' }
function isBus (leg: WalkLeg | BusLeg): leg is BusLeg  { return leg.type === 'bus'  }

function fmt(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
function fmtDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}
function badgeStyle(color: string) { return { background: color, color: '#fff' } }
</script>

<template>
  <!-- ── Skeleton ── -->
  <div v-if="store.loading" class="space-y-2">
    <div
      v-for="i in 3"
      :key="i"
      class="rounded-xl border p-3 flex items-center gap-3"
      :style="{ background: theme === 'dark' ? 'var(--dk-card)' : 'white', borderColor: theme === 'dark' ? 'var(--dk-border-md)' : '#e2e8f0' }"
    >
      <div
        class="w-8 h-8 rounded-lg animate-pulse shrink-0"
        :class="theme === 'dark' ? 'bg-[#ffffff08]' : 'bg-slate-100'"
      />
      <div class="flex-1 space-y-1.5">
        <div
          class="h-2.5 w-2/3 rounded-full animate-pulse"
          :class="theme === 'dark' ? 'bg-[#ffffff08]' : 'bg-slate-100'"
        />
        <div
          class="h-2.5 w-1/3 rounded-full animate-pulse"
          :class="theme === 'dark' ? 'bg-[#ffffff05]' : 'bg-slate-50'"
        />
      </div>
      <div
        class="h-3 w-12 rounded-full animate-pulse"
        :class="theme === 'dark' ? 'bg-[#ffffff08]' : 'bg-slate-100'"
      />
    </div>
  </div>

  <!-- ── Résultats ── -->
  <div v-else-if="store.result" class="space-y-2">
    <!-- Résumé A → B
    <div class="flex items-center gap-2 px-1 py-0.5">
      <div class="flex flex-col items-center gap-0.5 shrink-0">
        <span class="w-[15px] h-[15px] rounded-full flex items-center justify-center text-[8px] font-black text-white" style="background:#00b7cc">A</span>
        <span class="w-px h-2.5" :class="theme === 'dark' ? 'bg-[var(--dk-border-md)]' : 'bg-slate-200'"></span>
        <span class="w-[15px] h-[15px] rounded-full flex items-center justify-center text-[8px] font-black text-white" style="background:#e07b54">B</span>
      </div>
      <div class="flex-1 min-w-0 space-y-0.5">
        <p class="text-[12px] font-semibold truncate" :class="theme === 'dark' ? 'text-[var(--dk-text-1)]' : 'text-slate-700'">{{ store.result.from.address }}</p>
        <p class="text-[12px] font-semibold truncate" :class="theme === 'dark' ? 'text-[var(--dk-text-1)]' : 'text-slate-700'">{{ store.result.to.address }}</p>
      </div>
    </div>-->

    <!-- Option tout à pied -->
    <div
      class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
      :style="store.result.options.length === 0
        ? 'border-width:1px; border-style:solid; background:#2ea04320; border-color:#2ea04360'
        : 'border-width:1px; border-style:solid; background:#2ea04312; border-color:#2ea04338'"
    >
      <div
        class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style="background:#2ea04320"
      >
        <Footprints class="w-4 h-4 text-[#2ea043]" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-[13px] font-semibold text-[#2ea043]">
          Tout à pied
          <!-- Badge "Recommandé" quand le trajet est court -->
          <span
            v-if="store.result.options.length === 0"
            class="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
            style="background:#2ea04330; color:#2ea043"
          >
            Recommandé
          </span>
        </div>
        <div
          class="text-[11px]"
          :class="theme === 'dark' ? 'text-[var(--dk-text-2)]' : 'text-slate-400'"
        >
          {{ fmtDist(store.result.walkingOnly.distanceKm) }}
        </div>
      </div>
      <div class="flex items-center gap-1 text-[#2ea043] font-bold text-[13px] shrink-0">
        <Clock class="w-3.5 h-3.5" />
        {{ fmt(store.result.walkingOnly.durationMin) }}
      </div>
    </div>

    <!-- Aucun bus : explication contextuelle -->
    <div
      v-if="store.result.options.length === 0"
      class="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12px]"
      :class="store.result.walkingOnly.distanceKm < 0.65
        ? (theme === 'dark' ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
        : (theme === 'dark' ? 'bg-amber-950/20 border-amber-900/40 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700')"
    >
      <AlertCircle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span v-if="store.result.walkingOnly.distanceKm < 0.65">
        Destination proche (&lt; 500 m) — la marche est plus rapide que tout bus.
      </span>
      <span v-else> Aucune ligne de bus ne relie ces deux points de façon avantageuse. </span>
    </div>

    <!-- Options bus -->
    <div
      v-for="(option, i) in store.result.options"
      :key="i"
      class="rounded-xl border overflow-hidden"
      :style="{ borderColor: theme === 'dark' ? 'var(--dk-border-md)' : '#e2e8f0' }"
    >
      <!-- Header cliquable -->
      <button
        class="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors"
        :style="{ background: theme === 'dark' ? 'var(--dk-card)' : 'white' }"
        :class="theme === 'dark' ? 'dk-hover' : 'hover:bg-slate-50'"
        @click="toggle(i)"
      >
        <!-- Badge numéro -->
        <span
          class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
          :class="theme === 'dark' ? 'bg-[#00b7cc]/20 text-[#00b7cc]' : 'bg-[#0099ad]/10 text-[#0099ad]'"
        >
          {{ i + 1 }}
        </span>

        <div class="flex-1 flex items-center gap-1 min-w-0 flex-wrap">
          <template v-for="(leg, li) in option.legs" :key="li">
            <!-- Marche initiale ou finale uniquement si notable -->
            <template
              v-if="isWalk(leg) && (li === 0 || li === option.legs.length - 1) && leg.durationMin > 2"
            >
              <span
                v-if="li > 0"
                class="text-[10px]"
                :class="theme === 'dark' ? 'text-[var(--dk-text-3)]' : 'text-slate-300'"
                >›</span
              >
              <span
                class="flex items-center gap-0.5 text-[11px]"
                :class="theme === 'dark' ? 'text-[var(--dk-text-2)]' : 'text-slate-400'"
              >
                <Footprints class="w-3 h-3" />{{ fmt(leg.durationMin) }}
              </span>
            </template>
            <!-- Bus : toujours affiché avec badge couleur -->
            <template v-else-if="isBus(leg)">
              <span
                v-if="li > 0"
                class="text-[10px]"
                :class="theme === 'dark' ? 'text-[var(--dk-text-3)]' : 'text-slate-300'"
                >›</span
              >
              <span class="flex items-center gap-1">
                <span
                  class="px-1.5 py-0.5 rounded-[4px] text-[11px] font-bold leading-none"
                  :style="badgeStyle(leg.route.color)"
                >
                  {{ leg.route.routeShortName }}
                </span>
                <span
                  class="text-[11px]"
                  :class="theme === 'dark' ? 'text-[var(--dk-text-2)]' : 'text-slate-400'"
                >
                  {{ leg.stopCount }} arrêt{{ leg.stopCount > 1 ? 's' : '' }}
                </span>
              </span>
            </template>
          </template>
          <!-- Nombre de correspondances si > 1 bus -->
          <span
            v-if="option.legs.filter(l => l.type === 'bus').length > 1"
            class="text-[10px] px-1 py-0.5 rounded font-medium"
            :class="theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-500'"
          >
            {{ option.legs.filter(l => l.type === 'bus').length - 1 }} corresp.
          </span>
        </div>

        <!-- Durée totale + chevron -->
        <div class="flex items-center gap-1.5 shrink-0">
          <span
            class="flex items-center gap-1 font-bold text-[13px]"
            :class="theme === 'dark' ? 'text-[#00b7cc]' : 'text-[#0099ad]'"
          >
            <Clock class="w-3.5 h-3.5" />
            {{ fmt(option.totalDurationMin) }}
          </span>
          <component
            :is="expandedIndex === i ? ChevronUp : ChevronDown"
            class="w-3.5 h-3.5"
            :class="theme === 'dark' ? 'text-[var(--dk-text-3)]' : 'text-slate-300'"
          />
        </div>
      </button>

      <!-- Détail déployable -->
      <Transition name="slide">
        <div
          v-if="expandedIndex === i"
          class="border-t px-3.5 py-3 space-y-0"
          :style="{ borderColor: theme === 'dark' ? 'var(--dk-border)' : '#f0f3f9', background: theme === 'dark' ? 'var(--dk-surface)' : '#f8fafc' }"
        >
          <template v-for="(leg, li) in option.legs" :key="li">
            <!-- Segment marche -->
            <div v-if="isWalk(leg)" class="flex gap-2.5">
              <div class="flex flex-col items-center w-5 shrink-0">
                <!-- Dot : bleu départ, orange arrivée, violet correspondance -->
                <div
                  class="w-2 h-2 rounded-full mt-1 shrink-0"
                  :style="li === 0
                       ? 'background:#00b7cc'
                       : li === option.legs.length - 1
                         ? 'background:#e07b54'
                         : 'background:#8b5cf6'"
                />
                <!-- Toujours afficher : la destination finale est toujours sous le dernier leg -->
                <!-- Moitié haute de la ligne -->
                <div
                  class="w-px flex-1 mt-1"
                  :style="li !== 0 && li !== option.legs.length - 1 ? 'background:#8b5cf640' : ''"
                  :class="(li === 0 || li === option.legs.length - 1) ? (theme === 'dark' ? 'bg-[var(--dk-border-md)]' : 'bg-slate-200') : ''"
                />
                <!-- Icône chaussure -->
                <Footprints
                  class="w-3 h-3 shrink-0 my-0.5"
                  :class="(li !== 0 && li !== option.legs.length - 1)
                    ? 'text-purple-400'
                    : (theme === 'dark' ? 'text-[var(--dk-text-3)]' : 'text-slate-300')"
                />
                <!-- Moitié basse de la ligne -->
                <div
                  class="w-px flex-1 mb-1"
                  :style="li !== 0 && li !== option.legs.length - 1 ? 'background:#8b5cf640' : ''"
                  :class="(li === 0 || li === option.legs.length - 1) ? (theme === 'dark' ? 'bg-[var(--dk-border-md)]' : 'bg-slate-200') : ''"
                />
              </div>
              <div class="flex-1 pb-2.5 min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div
                      class="flex items-center gap-1 text-[12px] font-medium"
                      :class="theme === 'dark' ? 'text-[var(--dk-text-1)]' : 'text-slate-700'"
                    >
                      <!-- Icône : MapPin départ/arrivée, ArrowLeftRight pour correspondance -->
                      <MapPin v-if="li === 0" class="w-3 h-3 shrink-0" style="color:#00b7cc" />
                      <MapPin
                        v-else-if="li === option.legs.length - 1"
                        class="w-3 h-3 shrink-0"
                        style="color:#e07b54"
                      />
                      <ArrowLeftRight v-else class="w-3 h-3 shrink-0" style="color:#8b5cf6" />
                      <span class="truncate">
                        {{ li === 0
                          ? (leg.from.name ?? leg.from.stopName)
                          : (leg.from.stopName ?? leg.from.name) }}
                      </span>
                    </div>
                    <!-- Label : "Marcher" ou "Correspondance" -->
                    <div
                      v-if="li !== 0 && li !== option.legs.length - 1"
                      class="text-[11px] mt-0.5 ml-4 flex items-center gap-1"
                      :class="theme === 'dark' ? 'text-purple-400' : 'text-purple-500'"
                    >
                      <ArrowLeftRight class="w-2.5 h-2.5" />
                      Correspondance · {{ fmtDist(leg.distanceKm) }}
                    </div>
                    <div
                      v-else
                      class="text-[11px] mt-0.5 ml-4"
                      :class="theme === 'dark' ? 'text-[var(--dk-text-2)]' : 'text-slate-400'"
                    >
                      Marcher {{ fmtDist(leg.distanceKm) }}
                    </div>
                  </div>
                  <span
                    class="flex items-center gap-1 text-[11px] font-semibold shrink-0"
                    :class="(li !== 0 && li !== option.legs.length - 1)
                          ? (theme === 'dark' ? 'text-purple-400' : 'text-purple-500')
                          : (theme === 'dark' ? 'text-[var(--dk-text-2)]' : 'text-slate-400')"
                  >
                    <Footprints class="w-3 h-3" />{{ fmt(leg.durationMin) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Segment bus -->
            <div v-else-if="isBus(leg)" class="flex gap-2.5">
              <div class="flex flex-col items-center w-5 shrink-0">
                <div
                  class="w-2 h-2 rounded-full mt-1 shrink-0"
                  :class="theme === 'dark' ? 'bg-[var(--dk-text-3)]' : 'bg-slate-300'"
                />
                <div
                  class="w-px flex-1 my-1"
                  :class="theme === 'dark' ? 'bg-[var(--dk-border-md)]' : 'bg-slate-200'"
                />
              </div>
              <div class="flex-1 pb-2.5 min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div
                      class="text-[12px] font-medium truncate"
                      :class="theme === 'dark' ? 'text-[var(--dk-text-1)]' : 'text-slate-700'"
                    >
                      {{ leg.from.stopName }}
                    </div>
                    <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span
                        class="px-1.5 py-0.5 rounded-[4px] text-[11px] font-bold leading-none flex items-center gap-0.5"
                        :style="badgeStyle(leg.route.color)"
                      >
                        <Bus class="w-2.5 h-2.5" />{{ leg.route.routeShortName }}
                      </span>
                      <span
                        class="flex items-center gap-0.5 text-[11px]"
                        :class="theme === 'dark' ? 'text-[var(--dk-text-2)]' : 'text-slate-500'"
                      >
                        <ArrowRight class="w-3 h-3" />{{ leg.route.direction }}
                      </span>
                    </div>
                    <div
                      class="text-[11px] mt-1"
                      :class="theme === 'dark' ? 'text-[var(--dk-text-2)]' : 'text-slate-400'"
                    >
                      Descendre à
                      <span
                        class="font-medium"
                        :class="theme === 'dark' ? 'text-[var(--dk-text-1)]' : 'text-slate-600'"
                        >{{ leg.to.stopName }}</span
                      >
                      · {{ leg.stopCount }} arrêt{{ leg.stopCount > 1 ? 's' : '' }}
                    </div>
                  </div>
                  <span
                    class="flex items-center gap-1 text-[11px] font-semibold shrink-0"
                    :class="theme === 'dark' ? 'text-[var(--dk-text-2)]' : 'text-slate-400'"
                  >
                    <Bus class="w-3 h-3" />~{{ fmt(leg.durationMin) }}
                  </span>
                </div>
              </div>
            </div>
          </template>

          <!-- Destination finale -->
          <div class="flex gap-2.5">
            <div class="w-5 flex justify-center shrink-0">
              <div class="w-2 h-2 rounded-full mt-1" style="background:#e07b54" />
            </div>
            <div
              class="flex items-center gap-1 text-[12px] font-medium pb-0.5"
              :class="theme === 'dark' ? 'text-[var(--dk-text-1)]' : 'text-slate-700'"
            >
              <MapPin class="w-3 h-3 shrink-0" style="color:#e07b54" />
              {{ store.result?.to.address }}
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>

  <!-- ── Erreur ── -->
  <div
    v-else-if="store.error"
    class="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12px]"
    :class="theme === 'dark' ? 'bg-red-950/20 border-red-900/40 text-red-400' : 'bg-red-50 border-red-200 text-red-600'"
  >
    <AlertCircle class="w-3.5 h-3.5 mt-0.5 shrink-0" />
    {{ store.error }}
  </div>
</template>

<style scoped>
.slide-enter-active, .slide-leave-active { transition: all 0.18s ease; overflow: hidden; }
.slide-enter-from, .slide-leave-to       { max-height: 0; opacity: 0; }
.slide-enter-to,   .slide-leave-from     { max-height: 1200px; opacity: 1; }
</style>

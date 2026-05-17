<script setup lang="ts">
import { ref } from 'vue'
import { ArrowUpDown, Search, Loader2, X, MapPin } from 'lucide-vue-next'
import { useItineraryStore } from '@/stores/itinerary'
import { useTheme } from '@/composables/useTheme'
import { useAddressAutocomplete } from '@/composables/useAddressAutocomplete'

const store = useItineraryStore()
const { theme } = useTheme()

const fromAc    = useAddressAutocomplete()
const toAc      = useAddressAutocomplete()
const fromFocus = ref(false)
const toFocus   = ref(false)
const fromRef   = ref<HTMLInputElement | null>(null)
const toRef     = ref<HTMLInputElement | null>(null)

function onFromInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  store.fromAddress = val
  fromAc.query(val)
}
function onToInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  store.toAddress = val
  toAc.query(val)
}
function selectFrom(label: string) { store.fromAddress = label; fromAc.clear() }
function selectTo(label: string)   { store.toAddress   = label; toAc.clear()   }
function clearFrom() { store.fromAddress = ''; fromAc.clear(); fromRef.value?.focus() }
function clearTo()   { store.toAddress   = ''; toAc.clear();   toRef.value?.focus()   }

function onFromKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter')  { fromAc.clear(); if (store.toAddress) { store.search() } else { toRef.value?.focus() } }
  if (e.key === 'Escape') fromAc.clear()
}
function onToKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter')  { toAc.clear(); store.search() }
  if (e.key === 'Escape') toAc.clear()
}
</script>

<template>
  <div
    class="rounded-2xl border shadow-sm overflow-visible"
    :style="{ background: theme==='dark' ? 'var(--dk-card)' : 'white', borderColor: theme==='dark' ? 'var(--dk-border-md)' : '#e2e8f0' }"
  >
    <div class="flex gap-0">
      <!-- ── Colonne timeline + swap ── -->
      <div
        class="flex flex-col items-center pl-4 pr-0 w-8 shrink-0"
        style="padding-top:20px; padding-bottom:19px"
      >
        <!-- Dot départ -->
        <div
          class="w-2.5 h-2.5 rounded-full shrink-0"
          style="background:#00b7cc; box-shadow:0 0 0 3px rgba(0,183,204,0.18)"
        ></div>
        <!-- Ligne haute -->
        <div
          class="w-px grow"
          :class="theme==='dark' ? 'bg-[var(--dk-border-md)]' : 'bg-slate-200'"
        ></div>
        <!-- Bouton swap -->
        <button
          class="w-6 h-6 my-1 rounded-full flex items-center justify-center shrink-0 border transition-all active:scale-90"
          :class="theme==='dark'
            ? 'bg-[#21252f] border-[var(--dk-border-md)] text-[#00b7cc] hover:bg-[var(--dk-hover)]'
            : 'bg-white border-[#e2e8f0] text-[#0099ad] hover:bg-slate-50'"
          style="box-shadow:0 1px 4px rgba(0,0,0,0.10)"
          @click="store.swap()"
          title="Inverser"
        >
          <ArrowUpDown class="w-3 h-3" />
        </button>
        <!-- Ligne basse -->
        <div
          class="w-px grow"
          :class="theme==='dark' ? 'bg-[var(--dk-border-md)]' : 'bg-slate-200'"
        ></div>
        <!-- Dot arrivée -->
        <div
          class="w-2.5 h-2.5 rounded-full shrink-0"
          style="background:#e07b54; box-shadow:0 0 0 3px rgba(224,123,84,0.18)"
        ></div>
      </div>

      <!-- ── Colonne inputs ── -->
      <div class="flex-1 min-w-0 py-4 pr-4 pl-3">
        <!-- Départ -->
        <div class="relative">
          <p
            class="text-[10px] font-bold uppercase tracking-widest mb-1"
            :class="theme==='dark' ? 'text-[#8b949e]' : 'text-slate-400'"
          >
            Départ
          </p>
          <div
            class="flex items-center gap-2 h-9 px-2.5 rounded-xl transition-all duration-150"
            :style="fromFocus
              ? { background: theme==='dark' ? 'rgba(0,183,204,0.07)' : 'rgba(0,153,173,0.05)', boxShadow: '0 0 0 1.5px rgba(0,183,204,0.4)' }
              : { background: theme==='dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc' }"
          >
            <input
              ref="fromRef"
              :value="store.fromAddress"
              type="text"
              autocomplete="off"
              placeholder="D'où partez-vous ?"
              class="flex-1 min-w-0 bg-transparent border-0 p-0 text-[12.5px] font-medium placeholder:font-normal focus:ring-0 focus:outline-none"
              :class="theme==='dark' ? 'text-[var(--dk-text-1)] placeholder:text-[var(--dk-text-3)]' : 'text-slate-700 placeholder:text-slate-300'"
              @input="onFromInput"
              @keydown="onFromKeydown"
              @focus="fromFocus = true"
              @blur="fromFocus = false"
            />
            <Loader2
              v-if="fromAc.loading.value"
              class="w-3 h-3 shrink-0 animate-spin text-slate-300"
            />
            <button
              v-else-if="store.fromAddress"
              class="shrink-0 w-4 h-4 flex items-center justify-center rounded-full transition-colors"
              :class="theme==='dark' ? 'bg-[#ffffff12] hover:bg-[#ffffff20] text-[var(--dk-text-3)]' : 'bg-slate-200 hover:bg-slate-300 text-slate-400'"
              @mousedown.prevent="clearFrom"
            >
              <X class="w-2.5 h-2.5" />
            </button>
          </div>
          <!-- Suggestions départ -->
          <Transition name="suggest">
            <ul
              v-if="fromAc.suggestions.value.length"
              class="absolute top-full left-0 right-0 mt-1 max-h-[200px] overflow-y-auto rounded-xl border py-1 z-50 list-none m-0 px-0"
              :style="{ background: theme==='dark' ? 'var(--dk-card)' : 'white', borderColor: theme==='dark' ? 'var(--dk-border-md)' : '#e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }"
            >
              <li v-for="s in fromAc.suggestions.value" :key="s.displayName">
                <button
                  type="button"
                  class="w-full flex items-center gap-2 px-3 py-2 text-[11.5px] font-medium text-left transition-colors"
                  :class="theme==='dark' ? 'text-[var(--dk-text-1)] hover:bg-[#00b7cc]/10 hover:text-[#00b7cc]' : 'text-slate-700 hover:bg-[#e6f9fc] hover:text-[#00838f]'"
                  @mousedown.prevent="selectFrom(fromAc.select(s))"
                >
                  <MapPin class="w-3 h-3 text-[#00b7cc] shrink-0" />
                  <span class="truncate">{{ s.label }}</span>
                </button>
              </li>
            </ul>
          </Transition>
        </div>

        <!-- Divider -->
        <div
          class="h-px my-2"
          :style="{ background: theme==='dark' ? 'var(--dk-border)' : '#f1f5f9' }"
        ></div>

        <!-- Arrivée -->
        <div class="relative">
          <p
            class="text-[10px] font-bold uppercase tracking-widest mb-1"
            :class="theme==='dark' ? 'text-[#8b949e]' : 'text-slate-400'"
          >
            Arrivée
          </p>
          <div
            class="flex items-center gap-2 h-9 px-2.5 rounded-xl transition-all duration-150"
            :style="toFocus
              ? { background: theme==='dark' ? 'rgba(224,123,84,0.07)' : 'rgba(224,123,84,0.05)', boxShadow: '0 0 0 1.5px rgba(224,123,84,0.4)' }
              : { background: theme==='dark' ? 'rgba(255,255,255,0.04)' : '#f8fafc' }"
          >
            <input
              ref="toRef"
              :value="store.toAddress"
              type="text"
              autocomplete="off"
              placeholder="Où allez-vous ?"
              class="flex-1 min-w-0 bg-transparent border-0 p-0 text-[12.5px] font-medium placeholder:font-normal focus:ring-0 focus:outline-none"
              :class="theme==='dark' ? 'text-[var(--dk-text-1)] placeholder:text-[var(--dk-text-3)]' : 'text-slate-700 placeholder:text-slate-300'"
              @input="onToInput"
              @keydown="onToKeydown"
              @focus="toFocus = true"
              @blur="toFocus = false"
            />
            <Loader2
              v-if="toAc.loading.value"
              class="w-3 h-3 shrink-0 animate-spin text-slate-300"
            />
            <button
              v-else-if="store.toAddress"
              class="shrink-0 w-4 h-4 flex items-center justify-center rounded-full transition-colors"
              :class="theme==='dark' ? 'bg-[#ffffff12] hover:bg-[#ffffff20] text-[var(--dk-text-3)]' : 'bg-slate-200 hover:bg-slate-300 text-slate-400'"
              @mousedown.prevent="clearTo"
            >
              <X class="w-2.5 h-2.5" />
            </button>
          </div>
          <!-- Suggestions arrivée -->
          <Transition name="suggest">
            <ul
              v-if="toAc.suggestions.value.length"
              class="absolute top-full left-0 right-0 mt-1 max-h-[200px] overflow-y-auto rounded-xl border py-1 z-50 list-none m-0 px-0"
              :style="{ background: theme==='dark' ? 'var(--dk-card)' : 'white', borderColor: theme==='dark' ? 'var(--dk-border-md)' : '#e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }"
            >
              <li v-for="s in toAc.suggestions.value" :key="s.displayName">
                <button
                  type="button"
                  class="w-full flex items-center gap-2 px-3 py-2 text-[11.5px] font-medium text-left transition-colors"
                  :class="theme==='dark' ? 'text-[var(--dk-text-1)] hover:bg-[#e07b54]/10 hover:text-[#e07b54]' : 'text-slate-700 hover:bg-[#fdf0eb] hover:text-[#c05a35]'"
                  @mousedown.prevent="selectTo(toAc.select(s))"
                >
                  <MapPin class="w-3 h-3 text-[#e07b54] shrink-0" />
                  <span class="truncate">{{ s.label }}</span>
                </button>
              </li>
            </ul>
          </Transition>
        </div>
      </div>
    </div>

    <!-- ── Séparateur + Bouton rechercher ── -->
    <div
      class="h-px mx-0"
      :style="{ background: theme==='dark' ? 'var(--dk-border-md)' : '#e2e8f0' }"
    ></div>
    <div class="p-3 space-y-2">
      <!-- Avertissement même adresse -->
      <p
        v-if="store.fromAddress.trim() && store.toAddress.trim() && store.fromAddress.trim().toLowerCase() === store.toAddress.trim().toLowerCase()"
        class="text-[11px] text-center font-medium"
        :class="theme==='dark' ? 'text-amber-400' : 'text-amber-600'"
      >
        Le départ et l'arrivée sont identiques.
      </p>
      <button
        class="search-btn w-full flex items-center justify-center gap-2 h-10 rounded-xl text-[13px] font-semibold"
        :class="theme==='dark' ? 'search-btn--dark' : 'search-btn--light'"
        :disabled="!store.fromAddress.trim() || !store.toAddress.trim() || store.loading || store.fromAddress.trim().toLowerCase() === store.toAddress.trim().toLowerCase()"
        @click="() => { fromAc.clear(); toAc.clear(); store.search() }"
      >
        <Loader2 v-if="store.loading" class="w-4 h-4 animate-spin" />
        <Search v-else class="w-4 h-4" />
        {{ store.loading ? 'Calcul en cours…' : 'Rechercher' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.suggest-enter-active, .suggest-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.suggest-enter-from, .suggest-leave-to       { opacity: 0; transform: translateY(-4px); }

.search-btn {
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.1s ease, opacity 0.15s ease;
}
.search-btn--light { background: #0099ad; color: white; }
.search-btn--light:hover:not(:disabled) { background: #007a8e; }
.search-btn--dark  { background: #00b7cc; color: #0d1117; }
.search-btn--dark:hover:not(:disabled)  { background: #00c8de; }
.search-btn:active:not(:disabled) { transform: scale(0.98); }
.search-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>

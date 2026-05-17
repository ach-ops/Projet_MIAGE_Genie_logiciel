<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Direction } from '@/types/types'
import { Signpost, X, ArrowRight, CheckCircle2 } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
const { theme } = useTheme()

const props = defineProps<{
  directions: Direction[]
  loading: boolean
  show: boolean
}>()

const emit = defineEmits<{
  'update:selectedDirection': [value: string]
}>()

const selectedDirection = ref('')
const searchText = ref('')
const isOpen = ref(false)

const filteredDirections = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return props.directions
  return props.directions.filter((d) => d.label.toLowerCase().includes(q))
})

function directionValue(direction: Direction) {
  return `${direction.stopId}|${direction.directionId}`
}

function openDropdown() {
  if (props.loading) return
  isOpen.value = true
}

function closeDropdown(event: FocusEvent) {
  const container = event.currentTarget as HTMLElement | null
  const next = event.relatedTarget as Node | null
  if (container && next && container.contains(next)) return
  isOpen.value = false
}

function selectDirection(direction: Direction) {
  selectedDirection.value = directionValue(direction)
  searchText.value = direction.label
  emit('update:selectedDirection', selectedDirection.value)
  isOpen.value = false
}

function clearDirection() {
  selectedDirection.value = ''
  searchText.value = ''
  emit('update:selectedDirection', '')
}

function commitTypedDirection() {
  const typed = searchText.value.trim().toLowerCase()
  if (!typed) { clearDirection(); return }
  const exact = props.directions.find((d) => d.label.toLowerCase() === typed)
  if (exact) selectDirection(exact)
  else clearDirection()
}

function pickFirstMatch() {
  const first = filteredDirections.value[0]
  if (first) selectDirection(first)
  else commitTypedDirection()
}

// Quand la liste de directions change (nouvelle ligne sélectionnée), on remet à zéro
watch(() => props.directions, () => {
  selectedDirection.value = ''
  searchText.value = ''
  isOpen.value = false
})
</script>

<template>
  <div v-if="show" class="relative z-30 w-full" @focusout="closeDropdown">
    <!-- Input -->
    <div
      class="flex items-center gap-2.5 h-11 px-3 dk-input rounded-xl border transition-all duration-150"
      :class="isOpen ? 'shadow-[0_0_0_3px_rgba(0,176,200,0.20)]' : ''"
      :style="isOpen
        ? { borderColor: 'var(--dk-accent-lt, #00b7cc)' }
        : { borderColor: theme === 'dark' ? 'var(--dk-border-md)' : '#e2e8f0' }"
    >
      <Signpost
        class="w-[14px] h-[14px] shrink-0 transition-colors"
        :class="isOpen ? 'text-[#00b7cc]' : 'text-slate-400'"
      />

      <input
        :disabled="loading"
        type="text"
        class="flex-1 min-w-0 bg-transparent border-0 p-0 text-[14px] font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal focus:ring-0"
        :placeholder="loading ? 'Chargement…' : 'Choisir une direction…'"
        v-model="searchText"
        @focus="openDropdown"
        @input="openDropdown"
        @keydown.enter.prevent="pickFirstMatch"
        @keydown.escape="isOpen = false"
      />

      <button
        v-if="selectedDirection && !isOpen"
        class="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dk-dim hover:bg-slate-200 text-slate-500 dark:text-[#8b949e] text-[11px] transition-colors"
        @mousedown.prevent="clearDirection"
        aria-label="Effacer"
      >
        <X class="w-3 h-3" />
      </button>

      <div
        v-if="loading"
        class="shrink-0 w-4 h-4 border-2 border-slate-200 border-t-[#00b7cc] rounded-full animate-spin"
      ></div>
    </div>

    <!-- Dropdown -->
    <Transition name="fade">
      <ul
        v-if="isOpen"
        class="absolute top-full left-0 right-0 mt-1.5 max-h-[240px] overflow-y-auto rounded-xl border shadow-lg dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)] py-1 z-50 list-none px-0 m-0"
        :style="{
          background:  theme === 'dark' ? 'var(--dk-card)' : 'white',
          borderColor: theme === 'dark' ? 'var(--dk-border)' : '#e2e8f0',
        }"
      >
        <li v-if="loading" class="px-4 py-3 text-[13px] text-slate-400 italic">Chargement…</li>
        <li
          v-else-if="filteredDirections.length === 0"
          class="px-4 py-3 text-[13px] text-slate-400 italic"
        >
          Aucune direction trouvée
        </li>
        <li v-for="direction in filteredDirections" :key="directionValue(direction)">
          <button
            type="button"
            class="w-full flex items-center justify-start text-left gap-2 px-3 py-2 text-[13px] font-medium transition-colors"
            :class="selectedDirection === directionValue(direction)
              ? 'bg-[#e6f9fc] dark:bg-[#00b7cc]/10 text-[#00838f] dark:text-[#00b7cc]'
              : 'text-slate-700 dark:text-[#e6edf3] hover:bg-slate-50 dk-hover'"
            @mousedown.prevent="selectDirection(direction)"
          >
            <CheckCircle2
              v-if="selectedDirection === directionValue(direction)"
              class="w-[13px] h-[13px] shrink-0 text-[#00b7cc]"
            />
            <ArrowRight v-else class="w-[13px] h-[13px] shrink-0 text-slate-300" />
            <span class="truncate">{{ direction.label }}</span>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

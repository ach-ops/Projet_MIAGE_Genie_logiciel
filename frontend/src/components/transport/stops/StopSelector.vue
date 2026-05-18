<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, X, MapPin, CheckCircle2 } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
const { theme } = useTheme()

const props = defineProps<{
  loading: boolean
  stopNames: string[]
}>()

const emit = defineEmits<{
  'update:selectedStop': [value: string]
}>()

const selectedStopName = ref('')
const searchText = ref('')
const isOpen = ref(false)

const filteredStopNames = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return props.stopNames
  return props.stopNames.filter((n) => n.toLowerCase().includes(q))
})

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

function selectStop(name: string) {
  selectedStopName.value = name
  searchText.value = name
  emit('update:selectedStop', name)
  isOpen.value = false
}

function clearStop() {
  selectedStopName.value = ''
  searchText.value = ''
  emit('update:selectedStop', '')
}

function commitTypedStop() {
  const typed = searchText.value.trim()
  if (!typed) {
    selectedStopName.value = ''
    emit('update:selectedStop', '')
    return
  }
  const exact = props.stopNames.find((n) => n.toLowerCase() === typed.toLowerCase())
  if (exact) selectStop(exact)
  else emit('update:selectedStop', '')
}

function pickFirstMatch() {
  const first = filteredStopNames.value[0]
  if (first) selectStop(first)
  else commitTypedStop()
}
</script>

<template>
  <div class="relative z-50 w-full" @focusout="closeDropdown">
    <!-- Input -->
    <div
      class="flex items-center gap-2.5 h-11 px-3 dk-input rounded-xl border transition-all duration-150"
      :class="isOpen ? 'shadow-[0_0_0_3px_rgba(0,176,200,0.20)]' : ''"
      :style="isOpen
        ? { borderColor: 'var(--dk-accent-lt, #00b7cc)' }
        : { borderColor: theme === 'dark' ? 'var(--dk-border-md)' : '#e2e8f0' }"
    >
      <Search
        class="w-[14px] h-[14px] shrink-0 transition-colors"
        :class="isOpen ? 'text-[#00b7cc]' : 'text-slate-400'"
      />

      <input
        :disabled="loading"
        type="text"
        class="flex-1 min-w-0 bg-transparent border-0 p-0 text-[14px] font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal focus:ring-0"
        :placeholder="loading ? 'Chargement des arrêts…' : 'Rechercher un arrêt…'"
        v-model="searchText"
        @focus="openDropdown"
        @input="openDropdown"
        @keydown.enter.prevent="pickFirstMatch"
        @keydown.escape="isOpen = false"
      />

      <button
        v-if="selectedStopName && !isOpen"
        class="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dk-dim hover:bg-slate-200 text-slate-500 dark:text-[#8b949e] text-[11px] transition-colors"
        @mousedown.prevent="clearStop"
        aria-label="Effacer la sélection"
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
        class="absolute top-full left-0 right-0 mt-1.5 max-h-[280px] overflow-y-auto rounded-xl border shadow-lg dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)] py-1 z-50 list-none px-0 m-0"
        :style="{
          background:   theme === 'dark' ? 'var(--dk-card)' : 'white',
          borderColor:  theme === 'dark' ? 'var(--dk-border)' : '#e2e8f0',
        }"
      >
        <li v-if="loading" class="px-4 py-3 text-[13px] text-slate-400 italic">Chargement…</li>
        <li
          v-else-if="filteredStopNames.length === 0"
          class="px-4 py-3 text-[13px] text-slate-400 italic"
        >
          Aucun arrêt trouvé
        </li>
        <li v-for="name in filteredStopNames" :key="name">
          <button
            type="button"
            class="w-full flex items-center justify-start gap-2 px-3 py-2.5 text-[13px] font-medium text-left transition-colors"
            :class="selectedStopName === name
              ? 'bg-[#e6f9fc] dark:bg-[#00b7cc]/10 text-[#00838f] dark:text-[#00b7cc]'
              : 'text-slate-700 dark:text-[#e6edf3] hover:bg-slate-50 dk-hover'"
            @mousedown.prevent="selectStop(name)"
          >
            <CheckCircle2
              v-if="selectedStopName === name"
              class="w-[13px] h-[13px] shrink-0 text-[#00b7cc]"
            />
            <MapPin v-else class="w-[13px] h-[13px] shrink-0 text-slate-300" />
            <span class="truncate">{{ name }}</span>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

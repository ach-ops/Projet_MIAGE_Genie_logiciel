<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useDelayFormat } from '@/composables/useDelayFormat'
import { API_BASE } from '@/config/api'

const { theme } = useTheme()
const { fmtDelay, delayColor } = useDelayFormat()

interface RouteDelay {
  routeId: string
  routeName: string
  color: string
  avgDelay: number
  samples: number
}

const routeDelays = ref<RouteDelay[]>([])

async function fetchDelays() {
  try {
    const res = await fetch(`${API_BASE}/api/stats/delays`)
    const data = await res.json()
    routeDelays.value = data.lines ?? []
  } catch {}
}

function getMessages() {
  const list: { text: string; color?: { light: string; dark: string } }[] = [
    { text: 'Bienvenue sur le site de STAN' }
  ]
  // Les trams (T1, T2…) passent en premier dans le bandeau
  const tram = routeDelays.value.filter((r) => r.routeName.toUpperCase().startsWith('T'))
  const others = routeDelays.value.filter((r) => !r.routeName.toUpperCase().startsWith('T'))
  for (const r of [...tram, ...others]) {
    list.push({
      text: `Ligne ${r.routeName} : ${fmtDelay(r.avgDelay)}`,
      color: delayColor(r.avgDelay)
    })
  }
  return list
}

// ── Animation ──────────────────────────────────────────────────────────

const trackRef = ref<HTMLElement | null>(null)
const hovered = ref(false)
const SPEED_PPS = 55 // pixels par seconde (vitesse de défilement)
let raf: number | null = null
let pos = 0
let lastTs = 0

function loop(ts: number) {
  if (lastTs > 0 && trackRef.value && !hovered.value) {
    const dt = ts - lastTs
    pos += (SPEED_PPS * dt) / 1000
    const third = trackRef.value.scrollWidth / 3
    if (third > 0 && pos >= 0) pos -= third
    trackRef.value.style.transform = `translateX(${pos}px)`
  }
  lastTs = ts
  raf = requestAnimationFrame(loop)
}

let delayTimer: ReturnType<typeof setInterval> | null = null

function onPageVisible() {
  if (document.visibilityState === 'visible') fetchDelays()
}

onMounted(async () => {
  await fetchDelays()
  if (trackRef.value) {
    pos = -(trackRef.value.scrollWidth / 3)
  }
  raf = requestAnimationFrame(loop)
  // Rafraîchit les retards toutes les 30 min
  document.addEventListener('visibilitychange', onPageVisible)
})

onUnmounted(() => {
  if (raf !== null) cancelAnimationFrame(raf)
  if (delayTimer !== null) clearInterval(delayTimer)
  document.removeEventListener('visibilitychange', onPageVisible)
})
</script>

<template>
  <div
    class="flex items-center h-[42px] rounded-[13px] overflow-hidden border-2 shadow-[0_6px_18px_rgba(0,0,0,0.12)] transition-colors duration-200"
    :style="
      theme === 'dark'
        ? { background: 'var(--dk-surface)', borderColor: 'var(--dk-border)' }
        : { background: 'white', borderColor: '#a9c6d1' }
    "
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <!-- Défilement -->
    <div
      class="flex-auto min-w-0 overflow-hidden flex items-center"
      :style="{ background: theme === 'dark' ? 'var(--dk-surface)' : 'white' }"
    >
      <div
        ref="trackRef"
        class="inline-flex items-center whitespace-nowrap will-change-transform select-none pl-2"
      >
        <!-- Le contenu est dupliqué 3 fois pour un défilement sans saut visible -->
        <template v-for="_ in 3" :key="_">
          <span
            v-for="(msg, i) in getMessages()"
            :key="i"
            class="text-[13px] font-medium tracking-[0.01em] pointer-events-none transition-colors duration-200"
            :style="msg.color ? { color: theme === 'dark' ? msg.color.dark : msg.color.light } : {}"
            :class="!msg.color ? (theme === 'dark' ? 'text-slate-300' : 'text-[#111111]') : ''"
          >
            {{ msg.text }}
            <span class="mx-[18px] text-[10px] opacity-[0.45]">◆</span>
          </span>
        </template>
      </div>
    </div>

    <!-- Logo STAN -->
    <div
      class="w-[70px] sm:w-[90px] min-w-[70px] sm:min-w-[90px] h-full flex-none flex items-center justify-end pr-1 box-border overflow-hidden bg-[#0099ad]"
    >
      <img
        src="../../img/trolley.png"
        alt="Trolley STAN"
        class="block w-auto h-[85%] max-w-full object-contain object-right scale-x-[-1]"
      />
    </div>
  </div>
</template>

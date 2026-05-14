<script setup lang="ts">
import voirie from '../../img/voirie.png'
import eau from '../../img/eau.png'
import chauffage from '../../img/chauffage.png'
import travaux from '../../img/travaux.png'
import info from '../../img/info.png'

const items = [
  { label: 'Voirie', icon: voirie },
  { label: 'Eau', icon: eau },
  { label: 'Chauffage', icon: chauffage },
  { label: 'Travaux', icon: travaux },
  { label: 'Autre', icon: info }
]
</script>

<template>
  <div class="px-4 pt-3 pb-4 border-t border-[#e8ecf3]">
    <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
      Incidents sur la carte
    </p>
    <div class="flex flex-wrap gap-x-4 gap-y-1.5">
      <div v-for="item in items" :key="item.label" class="flex items-center gap-1.5">
        <img :src="item.icon" class="w-3.5 h-3.5 shrink-0" :alt="item.label" />
        <span class="text-[11px] text-slate-500">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

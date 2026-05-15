<script setup lang="ts">
defineProps<{
  shortName: string
  color: string
  textColor: string
}>()
</script>

<template>
  <span
    class="inline-flex items-center justify-center min-w-[36px] h-[24px] px-2 rounded-md text-[13px] font-bold tracking-tight leading-none"
    :style="{ backgroundColor: `#${color}`, color: `#${textColor}` }"
  >
    {{ shortName }}
  </span>
</template>

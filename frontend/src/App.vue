<script setup lang="ts">
import { useTheme } from './composables/useTheme'
useTheme()
</script>

<template>
  <RouterView />
</template>

<style>
body {
  margin: 0;
  background: #d4e2ef;
}
</style>

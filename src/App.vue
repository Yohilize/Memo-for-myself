<script setup lang="ts">
import { RouterView } from 'vue-router'
import BackgroundLayer from '@/components/layout/BackgroundLayer.vue'
import DataManageModal from '@/components/dashboard/DataManageModal.vue'
</script>

<template>
  <BackgroundLayer />
  <main class="app-content">
    <RouterView />
  </main>
  <DataManageModal />
</template>

<style scoped>
.app-content {
  position: relative;
  z-index: var(--z-content);
  height: 100%;
}
</style>

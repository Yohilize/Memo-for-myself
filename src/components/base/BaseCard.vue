<script setup lang="ts">
interface Props {
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

withDefaults(defineProps<Props>(), {
  hover: false,
  padding: 'md',
})
</script>

<template>
  <div class="base-card" :class="[`padding-${padding}`, { hover }]">
    <slot />
  </div>
</template>

<style scoped>
.base-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
}

.base-card.hover {
  transition: all var(--duration-fast) var(--ease-out);
  cursor: pointer;
}

.base-card.hover:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  box-shadow: var(--glass-shadow-hover), var(--glass-highlight);
  transform: translateY(-2px);
}

.padding-none { padding: 0; }
.padding-sm { padding: var(--space-3); }
.padding-md { padding: var(--space-5); }
.padding-lg { padding: var(--space-6); }
</style>

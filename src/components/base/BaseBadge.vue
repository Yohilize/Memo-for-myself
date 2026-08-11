<script setup lang="ts">
interface Props {
  color?: string
  variant?: 'solid' | 'soft' | 'outline'
}

withDefaults(defineProps<Props>(), {
  color: 'var(--color-primary)',
  variant: 'soft',
})
</script>

<template>
  <span class="base-badge" :class="`variant-${variant}`" :style="{ '--badge-color': color }">
    <slot />
  </span>
</template>

<style scoped>
.base-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: 999px;
  line-height: 1.6;
  white-space: nowrap;
}

.variant-soft {
  background: color-mix(in srgb, var(--badge-color) 18%, transparent);
  color: var(--badge-color);
}

.variant-solid {
  background: var(--badge-color);
  color: white;
}

.variant-outline {
  border: 1px solid color-mix(in srgb, var(--badge-color) 40%, transparent);
  color: var(--badge-color);
}
</style>

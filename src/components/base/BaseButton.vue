<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
  disabled: false,
  type: 'button',
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="base-btn"
    :class="[`variant-${variant}`, `size-${size}`]"
  >
    <slot />
  </button>
</template>

<style scoped>
.base-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-weight: var(--font-medium);
  border-radius: var(--surface-radius);
  transition: all var(--duration-fast) var(--ease-out);
  white-space: nowrap;
  user-select: none;
}

.base-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Size */
.size-sm {
  padding: 6px 12px;
  font-size: var(--text-sm);
}

.size-md {
  padding: 8px 16px;
  font-size: var(--text-base);
}

.size-lg {
  padding: 12px 24px;
  font-size: var(--text-lg);
}

/* Variants */
.variant-primary {
  background: var(--gradient-primary);
  color: white;
  box-shadow: 0 4px 16px rgba(184, 134, 109, 0.25);
}

.variant-primary:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(184, 134, 109, 0.35);
  transform: translateY(-1px);
}

.variant-secondary {
  background: var(--surface-bg);
  color: var(--color-text-primary);
  border: 1px solid var(--surface-border);
}

.variant-secondary:hover:not(:disabled) {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
}

.variant-ghost {
  background: transparent;
  color: var(--color-text-secondary);
}

.variant-ghost:hover:not(:disabled) {
  background: var(--surface-bg);
  color: var(--color-text-primary);
}

.variant-danger {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-danger-light);
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.variant-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.25);
}
</style>

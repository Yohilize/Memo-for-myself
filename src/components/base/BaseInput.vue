<script setup lang="ts">
interface Props {
  modelValue?: string
  placeholder?: string
  type?: 'text' | 'password' | 'email' | 'number'
  disabled?: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    class="base-input"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

<style scoped>
.base-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  color: var(--color-text-primary);
  font-size: var(--text-base);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);
}

.base-input::placeholder {
  color: var(--color-text-tertiary);
}

.base-input:focus {
  border-color: var(--color-primary);
  background: var(--glass-bg-hover);
}

.base-input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>

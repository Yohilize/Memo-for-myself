<script setup lang="ts">
interface Props {
  modelValue: number
  min: number
  max: number
  step?: number
  label?: string
  unit?: string
}

defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function onInput(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="slider-control">
    <div v-if="label || $slots.default" class="slider-header">
      <span class="slider-label"><slot>{{ label }}</slot></span>
      <span class="slider-value">{{ modelValue }}{{ unit }}</span>
    </div>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      class="slider-input"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.slider-control {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slider-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.slider-value {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--color-primary-light);
  background: var(--surface-bg);
  padding: 1px 8px;
  border-radius: 6px;
}

.slider-input {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  background: var(--surface-bg);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-primary);
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(184, 134, 109, 0.3);
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-out);
}

.slider-input::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.slider-input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-primary);
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(184, 134, 109, 0.3);
  cursor: pointer;
}
</style>

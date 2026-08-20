<script setup lang="ts">
import BaseButton from '@/components/base/BaseButton.vue'

/**
 * 通用 Glassmorphism 确认弹窗。
 * 用于需要二次确认的破坏性操作（如删除图片组件）。
 */
defineProps<{
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}>()

const emit = defineEmits<{
  (event: 'cancel'): void
  (event: 'confirm'): void
}>()

function onCancel(): void {
  emit('cancel')
}
function onConfirm(): void {
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cf-fade">
      <div
        v-if="visible"
        class="cf-mask"
        role="presentation"
        @click.self="onCancel"
      >
        <section
          class="cf-dialog"
          role="alertdialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header class="cf-icon" :class="{ 'is-danger': danger }" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </header>
          <h2 class="cf-title">{{ title }}</h2>
          <p class="cf-message">{{ message }}</p>
          <footer class="cf-actions">
            <BaseButton variant="ghost" size="md" @click="onCancel">
              {{ cancelText ?? '取消' }}
            </BaseButton>
            <BaseButton
              :variant="danger ? 'danger' : 'primary'"
              size="md"
              @click="onConfirm"
            >
              {{ confirmText ?? '确认' }}
            </BaseButton>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cf-mask {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: color-mix(in srgb, var(--color-primary) 18%, rgba(255, 255, 255, 0.3));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.cf-dialog {
  width: min(100%, 320px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 22px 20px 18px;
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  background: var(--glass-bg);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  text-align: center;
}
.cf-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
}
.cf-icon.is-danger {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
}
.cf-title {
  margin: 0;
  font-size: 14px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.cf-message {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--color-text-tertiary);
}
.cf-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
}
.cf-fade-enter-active,
.cf-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}
.cf-fade-enter-from,
.cf-fade-leave-to {
  opacity: 0;
}
</style>
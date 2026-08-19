<script setup lang="ts">
import BaseButton from './BaseButton.vue'
import BaseCard from './BaseCard.vue'

defineProps<{
  visible: boolean
  eventTitle: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <!-- Teleport 到 body：与弹窗遮罩一致，避免被小组件 stacking context 困住而遮不住同级内容 -->
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div
        v-if="visible"
        class="confirm-mask"
        role="presentation"
        @click.self="emit('cancel')"
      >
      <BaseCard
        class="confirm-dialog"
        padding="md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div class="confirm-mark" aria-hidden="true">!</div>
        <div class="confirm-copy">
          <h2 id="confirm-dialog-title" class="confirm-title">删除事件？</h2>
          <p class="confirm-event-title">{{ eventTitle }}</p>
          <p class="confirm-hint">删除后无法恢复，请确认是否继续。</p>
        </div>
        <div class="confirm-actions">
          <BaseButton variant="ghost" size="sm" @click="emit('cancel')">取消</BaseButton>
          <BaseButton variant="danger" size="sm" @click="emit('confirm')">删除</BaseButton>
        </div>
      </BaseCard>
    </div>
  </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: color-mix(in srgb, var(--color-primary) 18%, rgba(255, 255, 255, 0.30));
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}
.confirm-dialog {
  width: min(100%, 320px);
  display: grid;
  grid-template-columns: 30px 1fr;
  gap: 4px 10px;
  align-items: start;
}
.confirm-mark {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--color-danger-light);
  background: color-mix(in srgb, var(--color-danger) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-danger) 28%, transparent);
  font-size: 14px;
  font-weight: var(--font-bold);
}
.confirm-copy {
  min-width: 0;
}
.confirm-title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: var(--font-semibold);
}
.confirm-event-title {
  margin: 7px 0 0;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: var(--font-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.confirm-hint {
  margin: 4px 0 0;
  color: var(--color-text-tertiary);
  font-size: 11px;
}
.confirm-actions {
  grid-column: 2;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}
.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}
</style>

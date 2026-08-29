<script setup lang="ts">
/**
 * ToggleCompleteButton — 通用「完成状态切换」按钮。
 *
 * 用途：一键切换任务型事件（calendar / deadline / duration）的完成状态：
 *   - completed ←> pending
 *   - 点击后通过 useEventStore().update(id, { status }) 写回事件数据，
 *     走现有 Pinia → Service → Repository → IndexedDB 链路，其他界面立即响应式同步。
 *
 * 复用约定：
 *   - 逻辑/交互在此处统一，不同页面只需按各自视觉要求传外部 class 定制外观
 *     （class 会透传合并到根 <button> 上）；idea 无状态，不参与。
 *   - 不使用任何固定色号，仅提供中性基础样式，页面可自由覆盖。
 */
import { computed } from 'vue'
import { useEventStore } from '@/stores/eventStore'
import type { EventStatus, TimeEvent } from '@/types/event'

const props = defineProps<{
  event: TimeEvent
}>()

const store = useEventStore()

/** idea 无 status（不参与任务），守卫函数缩小类型作用域避免 TS 报错。 */
function currentStatus(e: TimeEvent): EventStatus | undefined {
  return e.type === 'idea' ? undefined : e.status
}

const canToggle = computed(() => props.event.type !== 'idea')

const isComplete = computed(() => currentStatus(props.event) === 'completed')

const actionLabel = computed(() => (isComplete.value ? '标记为未完成' : '标记为已完成'))

function toggle(): void {
  if (!canToggle.value) return
  const next: EventStatus =
    currentStatus(props.event) === 'completed' ? 'pending' : 'completed'
  void store.update(props.event.id, { status: next })
}
</script>

<template>
  <button
    v-if="canToggle"
    type="button"
    class="tc-toggle-btn"
    :class="{ 'is-complete': isComplete }"
    :aria-pressed="isComplete"
    :aria-label="actionLabel"
    :title="actionLabel"
    @click="toggle"
  >
    <slot :is-complete="isComplete">{{ isComplete ? '已完成' : '未完成' }}</slot>
  </button>
</template>

<style scoped>
/* 中性基础样式；不同页面可按需传外部 class 覆盖视觉 */
.tc-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 10px;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}
.tc-toggle-btn:hover {
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 34%, transparent);
}
.tc-toggle-btn.is-complete {
  color: var(--color-text-on-gradient);
  background: var(--gradient-primary);
  border-color: transparent;
}
</style>
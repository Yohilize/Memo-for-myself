<script setup lang="ts">
import dayjs from 'dayjs'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import BaseBadge from '@/components/base/BaseBadge.vue'
import CalendarView from '@calendar/CalendarView.vue'
import { useDashboardPinnedEvent } from '@/composables/useDashboardPinnedEvent'
import {
  dayEventTimeLabel,
} from '@/services/eventCalendarMapper'
import type { TimeEvent } from '@/types/event'
import {
  useDashboardWidgetLayout,
  type DashboardWidgetId,
} from '@/composables/useDashboardWidgetLayout'

const props = defineProps<{
  events: TimeEvent[]
  allEvents: TimeEvent[]
  todayKey: string
  typeColorByType: Record<string, string>
  typeLabelByType: Record<string, string>
}>()

const emit = defineEmits<{
  (event: 'edit-event', value: TimeEvent): void
  (event: 'delete-event', value: TimeEvent): void
}>()

const widgetAreaRef = ref<HTMLElement | null>(null)
const canAddWidget = false
const pinnedPickerVisible = ref(false)
const { pinnedEvent, pinEvent, unpinEvent } = useDashboardPinnedEvent()

const statusLabelByStatus: Record<string, string> = {
  pending: '待办',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
}

function pinnedDateText(event: TimeEvent): string {
  switch (event.type) {
    case 'calendar':
      return dayjs(event.event_date).format('M月D日')
    case 'deadline':
      return dayjs(event.due_date).format('M月D日')
    case 'duration':
      return dayjs(event.start_time).format('M月D日')
    case 'idea':
      return dayjs(event.created_at).format('M月D日')
  }
}

function pinnedTimeText(event: TimeEvent): string {
  switch (event.type) {
    case 'calendar':
      return event.all_day ? '全天' : event.event_time || '未设置时间'
    case 'deadline': {
      const due = dayjs(event.due_date)
      return due.isValid() && (due.hour() !== 0 || due.minute() !== 0)
        ? `截止 ${due.format('HH:mm')}`
        : '截止'
    }
    case 'duration': {
      const start = dayjs(event.start_time)
      const end = dayjs(event.end_time)
      return start.isValid() && end.isValid()
        ? `${start.format('HH:mm')}–${end.format('HH:mm')}`
        : '时段'
    }
    case 'idea':
      return '灵感记录'
  }
}

function selectPinnedEvent(event: TimeEvent): void {
  pinEvent(event.id)
  pinnedPickerVisible.value = false
}

const {
  isEditMode,
  draggingWidgetId,
  widgetStyle,
  enterEditMode,
  exitEditMode,
  resetLayout,
  startDragging,
} = useDashboardWidgetLayout()

function onDragStart(widgetId: DashboardWidgetId, event: PointerEvent): void {
  startDragging(widgetId, event, widgetAreaRef.value)
}
</script>

<template>
  <section
    ref="widgetAreaRef"
    class="db-widget-area"
    :class="{ 'is-editing': isEditMode }"
    aria-label="Dashboard 小组件区域"
  >
    <div v-if="isEditMode" class="db-widget-grid" aria-hidden="true">
      <span v-for="n in 16" :key="n" class="db-widget-grid-cell"></span>
    </div>

    <section
      class="db-widget db-widget--events"
      :class="{ 'is-dragging': draggingWidgetId === 'today-events' }"
      :style="widgetStyle('today-events')"
      aria-labelledby="dashboard-today-events-title"
    >
      <header class="db-widget-head">
        <div>
          <h2 id="dashboard-today-events-title" class="db-widget-title">今日事件</h2>
          <span v-if="props.events.length" class="db-widget-count">
            {{ props.events.length }} 项
          </span>
        </div>
        <button
          v-if="isEditMode"
          class="db-widget-drag-handle"
          type="button"
          aria-label="拖动今日事件组件"
          title="拖动今日事件组件"
          @pointerdown.prevent.stop="onDragStart('today-events', $event)"
        >
          <span v-for="n in 6" :key="n"></span>
        </button>
      </header>

      <div class="db-widget-scroll">
        <div v-if="props.events.length" class="db-events">
          <div
            v-for="e in props.events"
            :key="e.id"
            class="db-event"
            role="button"
            tabindex="0"
            :style="{ '--c': props.typeColorByType[e.type] ?? 'var(--color-text-tertiary)' }"
            :title="`${props.typeLabelByType[e.type]} · 点击编辑`"
            @click="emit('edit-event', e)"
            @keydown.enter="emit('edit-event', e)"
          >
            <span class="db-event-dot"></span>
            <div class="db-event-body">
              <div class="db-event-title">{{ e.title }}</div>
              <div class="db-event-meta">
                {{ props.typeLabelByType[e.type] ?? e.type }} · {{ dayEventTimeLabel(e, props.todayKey) }}
              </div>
            </div>
            <BaseBadge :color="props.typeColorByType[e.type] ?? 'var(--color-text-tertiary)'">
              {{ props.typeLabelByType[e.type] ?? e.type }}
            </BaseBadge>
            <div class="db-event-actions">
              <button
                class="dbe-btn"
                type="button"
                aria-label="编辑"
                title="编辑"
                @click.stop="emit('edit-event', e)"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
              </button>
              <button
                class="dbe-btn dbe-btn--danger"
                type="button"
                aria-label="删除"
                title="删除"
                @click.stop="emit('delete-event', e)"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div v-else class="db-events-empty">
          <span class="db-empty-ic">·</span>
          <span>今天还没有事件，保持轻松的一天吧。</span>
        </div>
      </div>
    </section>

    <section
      class="db-widget db-widget--calendar"
      :class="{ 'is-dragging': draggingWidgetId === 'calendar' }"
      :style="widgetStyle('calendar')"
      aria-labelledby="dashboard-calendar-title"
    >
      <header class="db-widget-head">
        <div class="db-widget-title-row">
          <h2 id="dashboard-calendar-title" class="db-widget-title">日历</h2>
          <RouterLink to="/calendar" class="db-cal-link" title="打开 Calendar 独立调试页">独立页</RouterLink>
        </div>
        <button
          v-if="isEditMode"
          class="db-widget-drag-handle"
          type="button"
          aria-label="拖动日历组件"
          title="拖动日历组件"
          @pointerdown.prevent.stop="onDragStart('calendar', $event)"
        >
          <span v-for="n in 6" :key="n"></span>
        </button>
      </header>
      <div class="db-widget-scroll db-calendar-scroll">
        <CalendarView
          embedded
          @edit-event="emit('edit-event', $event)"
          @delete-event="emit('delete-event', $event)"
        />
      </div>
    </section>

    <section
      class="db-widget db-widget--pinned"
      :class="{ 'is-dragging': draggingWidgetId === 'pinned-event' }"
      :style="widgetStyle('pinned-event')"
      aria-labelledby="dashboard-pinned-event-title"
    >
      <header class="db-widget-head">
        <div class="db-widget-title-row">
          <h2 id="dashboard-pinned-event-title" class="db-widget-title">固定事件</h2>
          <span v-if="pinnedEvent" class="db-pinned-mark" aria-label="已固定">固定</span>
        </div>
        <button
          v-if="isEditMode"
          class="db-widget-drag-handle"
          type="button"
          aria-label="拖动固定事件组件"
          title="拖动固定事件组件"
          @pointerdown.prevent.stop="onDragStart('pinned-event', $event)"
        >
          <span v-for="n in 6" :key="n"></span>
        </button>
      </header>

      <div class="db-pinned-body">
        <template v-if="pinnedEvent">
          <button
            class="db-pinned-summary"
            type="button"
            :title="`${pinnedEvent.title} · 点击编辑`"
            @click="emit('edit-event', pinnedEvent)"
          >
            <span class="db-pinned-title">{{ pinnedEvent.title }}</span>
            <span class="db-pinned-meta">
              {{ pinnedDateText(pinnedEvent) }} · {{ pinnedTimeText(pinnedEvent) }}
            </span>
            <span class="db-pinned-meta">
              {{ props.typeLabelByType[pinnedEvent.type] ?? pinnedEvent.type }} ·
              {{ statusLabelByStatus[pinnedEvent.status] ?? pinnedEvent.status }}
            </span>
          </button>
        </template>
        <div v-else class="db-pinned-empty">暂无固定事件</div>
        <div class="db-pinned-controls">
          <button
            class="db-pinned-select"
            type="button"
            @click="pinnedPickerVisible = true"
          >
            选择事件
          </button>
          <button
            v-if="pinnedEvent"
            class="db-pinned-unpin"
            type="button"
            @click="unpinEvent"
          >
            取消固定
          </button>
        </div>
      </div>

      <div v-if="pinnedPickerVisible" class="db-pinned-picker" role="dialog" aria-label="选择固定事件">
        <div class="db-pinned-picker-head">
          <span>选择事件</span>
          <button
            class="db-pinned-picker-close"
            type="button"
            aria-label="关闭"
            @click="pinnedPickerVisible = false"
          >
            ×
          </button>
        </div>
        <div v-if="props.allEvents.length" class="db-pinned-options">
          <button
            v-for="event in props.allEvents"
            :key="event.id"
            class="db-pinned-option"
            type="button"
            @click="selectPinnedEvent(event)"
          >
            <span>{{ event.title }}</span>
            <small>{{ pinnedDateText(event) }} · {{ props.typeLabelByType[event.type] ?? event.type }}</small>
          </button>
        </div>
        <div v-else class="db-pinned-options-empty">暂无可固定事件</div>
      </div>
    </section>

    <div class="db-widget-actions" :class="{ 'is-editing': isEditMode }">
      <template v-if="isEditMode">
        <button
          class="db-widget-action"
          type="button"
          :disabled="!canAddWidget"
          aria-label="添加小组件"
          title="添加小组件（暂无可添加的小组件）"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <button
          class="db-widget-action"
          type="button"
          aria-label="恢复默认小组件布局"
          title="恢复默认小组件布局"
          @click="resetLayout"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/></svg>
        </button>
        <button
          class="db-widget-action db-widget-action--primary"
          type="button"
          aria-label="完成编辑"
          title="完成编辑"
          @click="exitEditMode"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>
        </button>
      </template>
      <button
        v-else
        class="db-widget-edit-button"
        type="button"
        aria-label="调整布局"
        title="调整布局"
        @click="enterEditMode"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.7 6.3 3 3M4 20l4.2-1 9.9-9.9a2.1 2.1 0 0 0-3-3L5.2 16z"/></svg>
        <span>调整布局</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.db-widget-area {
  --widget-gap: 14px;
  --widget-actions-space: 52px;
  --widget-row-min: 180px;
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(4, minmax(var(--widget-row-min), 1fr));
  gap: var(--widget-gap);
  min-height: calc(
    var(--widget-row-min) * 4 +
    var(--widget-gap) * 3 +
    var(--widget-actions-space)
  );
  padding-bottom: var(--widget-actions-space);
}

.db-widget-grid {
  position: absolute;
  inset: 0 0 var(--widget-actions-space);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(4, minmax(0, 1fr));
  gap: var(--widget-gap);
  pointer-events: none;
  z-index: 0;
}
.db-widget-grid-cell {
  border: 1px dashed color-mix(in srgb, var(--color-primary) 13%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-primary) 1.5%, transparent);
}

.db-widget {
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  box-shadow: 0 3px 14px color-mix(in srgb, var(--color-primary) 7%, transparent);
  transition:
    transform var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);
}
.db-widget.is-dragging {
  z-index: 3;
  cursor: grabbing;
  border-color: color-mix(in srgb, var(--color-accent) 42%, var(--surface-border));
  background: color-mix(in srgb, var(--glass-bg-hover) 86%, transparent);
  box-shadow:
    0 10px 28px color-mix(in srgb, var(--color-primary) 18%, transparent),
    0 0 0 2px color-mix(in srgb, var(--color-accent) 12%, transparent);
  transform: translateY(-2px) scale(1.005);
}
.is-editing .db-widget:not(.is-dragging) {
  border-color: color-mix(in srgb, var(--color-primary) 20%, var(--surface-border));
}

.db-widget-head {
  min-height: 42px;
  padding: 12px 12px 4px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  flex: 0 0 auto;
}
.db-widget-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.db-widget-title {
  font-size: 12px;
  line-height: 1.3;
  letter-spacing: 0.04em;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.db-widget-count {
  display: inline-block;
  margin-top: 3px;
  font-size: 10px;
  color: var(--color-text-tertiary);
}
.db-widget-drag-handle {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(2, 3px);
  grid-auto-rows: 3px;
  align-content: center;
  justify-content: center;
  gap: 3px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
  border-radius: 9px;
  color: var(--color-text-tertiary);
  cursor: grab;
  touch-action: none;
  transition:
    color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}
.db-widget-drag-handle:hover {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.db-widget-drag-handle span {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
}

.db-widget-scroll {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 6px 12px 12px;
}
.db-calendar-scroll {
  padding-top: 2px;
}
.db-cal-link {
  font-size: 10px;
  letter-spacing: 0.03em;
  color: var(--color-primary);
  text-decoration: none;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
  background: color-mix(in srgb, var(--color-primary) 5%, transparent);
  opacity: 0.82;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);
}
.db-cal-link:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.db-pinned-mark {
  padding: 2px 6px;
  border-radius: 999px;
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 9%, transparent);
  font-size: 9px;
  line-height: 1.2;
}
.db-pinned-body {
  position: relative;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 12px 12px;
}
.db-pinned-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.db-pinned-summary:hover .db-pinned-title {
  color: var(--color-primary);
}
.db-pinned-title {
  width: 100%;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: var(--font-semibold);
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--duration-fast) var(--ease-out);
}
.db-pinned-meta {
  max-width: 100%;
  overflow: hidden;
  color: var(--color-text-tertiary);
  font-size: 10px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.db-pinned-unpin,
.db-pinned-select {
  min-height: 25px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 5%, transparent);
  color: var(--color-primary);
  font-size: 10px;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}
.db-pinned-unpin:hover,
.db-pinned-select:hover {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.db-pinned-empty {
  color: var(--color-text-tertiary);
  font-size: 11px;
}
.db-pinned-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.db-pinned-picker {
  position: absolute;
  inset: 6px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 9px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--surface-border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--glass-bg) 96%, transparent);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--color-primary) 14%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.db-pinned-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 0 0 auto;
  padding-bottom: 6px;
  color: var(--color-text-secondary);
  font-size: 10px;
  font-weight: var(--font-semibold);
}
.db-pinned-picker-close {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.db-pinned-picker-close:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text-primary);
}
.db-pinned-options {
  min-height: 0;
  overflow-y: auto;
}
.db-pinned-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 7px 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-primary);
  text-align: left;
  cursor: pointer;
}
.db-pinned-option:hover {
  background: var(--glass-bg-hover);
}
.db-pinned-option span,
.db-pinned-option small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.db-pinned-option span {
  width: 100%;
  font-size: 11px;
}
.db-pinned-option small,
.db-pinned-options-empty {
  color: var(--color-text-tertiary);
  font-size: 9px;
}
.db-pinned-options-empty {
  padding: 8px 4px;
}

.db-events {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.db-event {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  padding: 9px 8px;
  background: color-mix(in srgb, var(--surface-bg) 84%, transparent);
  border: 1px solid var(--surface-border);
  border-left: 3px solid var(--c);
  border-radius: 10px;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.db-event:hover,
.db-event:focus-visible {
  outline: none;
  background: var(--glass-bg-hover);
  border-color: color-mix(in srgb, var(--color-primary) 18%, var(--surface-border));
  transform: translateX(2px);
}
.db-event-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--c);
}
.db-event-body {
  flex: 1;
  min-width: 0;
}
.db-event-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}
.db-event-meta {
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  color: var(--color-text-tertiary);
}
.db-event-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  opacity: 0;
  transform: translateX(4px);
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.db-event:hover .db-event-actions,
.db-event:focus-within .db-event-actions {
  opacity: 1;
  transform: translateX(0);
}
.dbe-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 7px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-text-tertiary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.dbe-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
}
.dbe-btn--danger:hover {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger-light);
  border-color: color-mix(in srgb, var(--color-danger) 28%, transparent);
}
.db-events-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 100%;
  padding: 12px 2px;
  font-size: 11px;
  color: var(--color-text-secondary);
}
.db-empty-ic {
  color: var(--color-text-tertiary);
  opacity: 0.7;
  font-size: 16px;
  line-height: 1;
}

.db-widget-actions {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 13%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--glass-bg) 90%, transparent);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--color-primary) 10%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.db-widget-edit-button,
.db-widget-action {
  min-height: 28px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 10px;
  color: var(--color-primary);
  border: 1px solid transparent;
  background: transparent;
  font-size: 10px;
  font-weight: var(--font-semibold);
  white-space: nowrap;
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.db-widget-edit-button:hover,
.db-widget-action:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
  transform: translateY(-1px);
}
.db-widget-action {
  width: 30px;
  padding: 0;
}
.db-widget-action:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.db-widget-action--primary {
  color: var(--color-text-on-gradient);
  background: var(--gradient-primary);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-accent) 18%, transparent);
}
.db-widget-action--primary:hover:not(:disabled) {
  color: var(--color-text-on-gradient);
  background: var(--gradient-primary);
  border-color: transparent;
}

@media (max-width: 780px) {
  .db-widget-area {
    --widget-row-min: 150px;
  }
  .db-event {
    align-items: flex-start;
  }
  .db-event :deep(.base-badge) {
    display: none;
  }
}

@media (max-width: 560px) {
  .db-widget-area {
    --widget-row-min: 140px;
  }
  .db-widget-actions {
    right: 0;
  }
}
</style>

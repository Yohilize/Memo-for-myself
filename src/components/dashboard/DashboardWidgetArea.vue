<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BaseBadge from '@/components/base/BaseBadge.vue'
import ToggleCompleteButton from '@/components/base/ToggleCompleteButton.vue'
import CalendarView from '@calendar/CalendarView.vue'
import ComponentPickerModal from './ComponentPickerModal.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import ImageCropModal from './ImageCropModal.vue'
import { useDashboardPinnedEvent } from '@/composables/useDashboardPinnedEvent'
import { useToday } from '@/composables/useToday'
import { deriveEventDisplayStatus } from '@/services/eventService'
import { useImageWidgetStore } from '@/stores'
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
const pinnedPickerVisible = ref(false)
const { pinnedEvents, pinEvent, unpinEvent } = useDashboardPinnedEvent()
const { todayKey } = useToday()

/** 置顶事件显示状态：非 idea 用「事件数据 + 今天」推导（无状态/已完成/已取消照常显示）。 */
function pinnedDisplayStatus(e: TimeEvent | null | undefined): string {
  if (!e || e.type === 'idea') return ''
  return deriveEventDisplayStatus(e, todayKey.value)
}

// —— 图片小组件：数据（IndexedDB）+ 添加/删除 交互 —— //
const imageStore = useImageWidgetStore()
const fileInputRef = ref<HTMLInputElement | null>(null)
const pickerVisible = ref(false)
const cropModalVisible = ref(false)
const cropSource = ref('')
const cropRatio = ref(1)

/** Dashboard 中实际渲染的图片组件 =「已有记录」且「在布局中」的那些 */
const layoutImageWidgets = computed(() =>
  imageStore.records.filter((r) => layout.value[r.id]),
)

onMounted(() => {
  void imageStore.loadAll()
})

/** 「+」→ 打开组件选择 GUI */
function openAddPicker(): void {
  pickerVisible.value = true
}

/** 组件选择 GUI 中选中某个组件后分发创建流程 */
function onPickerSelect(type: string): void {
  pickerVisible.value = false
  if (type === 'image') {
    openAddImage()
  }
}

function openAddImage(): void {
  fileInputRef.value?.click()
}

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    cropSource.value = reader.result as string
    const metrics = widgetAreaRef.value
      ? computeCellMetrics(widgetAreaRef.value)
      : undefined
    cropRatio.value = metrics?.ratio ?? 1
    cropModalVisible.value = true
  }
  reader.readAsDataURL(file)
}

async function onCropConfirm(dataUrl: string): Promise<void> {
  cropModalVisible.value = false
  try {
    const { id } = await imageStore.create(dataUrl)
    // 放置到第一个空闲 1×1 单元；布局已满则回滚该记录，避免留下无效数据
    if (!placeImageWidget(id)) {
      await imageStore.remove(id)
    }
  } catch (_err) {
    // imageStore.error 已持有文案，忽略
  }
}

/** 编辑模式下右下角删除按钮：先弹确认，再真正删除并清理数据与布局 key */
const deleteTargetId = ref<string | null>(null)
function requestDeleteImage(id: string): void {
  deleteTargetId.value = id
}
function cancelDeleteImage(): void {
  deleteTargetId.value = null
}
async function confirmDeleteImage(): Promise<void> {
  const id = deleteTargetId.value
  deleteTargetId.value = null
  if (!id) return
  removeWidget(id)
  try {
    await imageStore.remove(id)
  } catch (_err) {
    // imageStore.error 已持有文案，忽略
  }
}

const statusLabelByStatus: Record<string, string> = {
  pending: '待办',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  stateless: '无状态',
}

function pinnedDateText(event: TimeEvent): string {
  switch (event.type) {
    case 'calendar':
      return dayjs(event.event_date).format('M月D日')
    case 'deadline':
      return dayjs(event.due_date).format('M月D日')
    case 'duration':
      return dayjs(event.start_date).format('M月D日')
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
      const start = dayjs(event.start_date)
      if (!start.isValid()) return '时间块'
      // 无结束日期：已开始、未定结束 → 「进行中」
      if (!event.end_date) return '进行中'
      const end = dayjs(event.end_date)
      if (!end.isValid()) return '时间块'
      return `${start.format('M月D日')}–${end.format('M月D日')}`
    }
    case 'idea':
      return '灵感记录'
  }
}

const priorityLabelByPriority: Record<'low' | 'medium' | 'high', string> = {
  low: '低',
  medium: '中',
  high: '高',
}

/** 提取固定事件右侧可展示的正文：idea 优先 content，其余统一展示 notes（无则为空串）。 */
function pinnedBodyText(event: TimeEvent): string {
  if (event.type === 'idea') return event.content || event.notes
  return event.notes
}

function selectPinnedEvent(event: TimeEvent): void {
  pinEvent(event.id)
  pinnedPickerVisible.value = false
}

/**
 * 固定事件锚点日期（date-only）：与 pinnedDateText 字段语义保持一致，
 * 用于「未来 3/7 天」时间范围筛选，仅做前端判断，不改动事件数据。
 */
function pinnedAnchorDate(event: TimeEvent): dayjs.Dayjs | null {
  switch (event.type) {
    case 'calendar':
      return dayjs(event.event_date)
    case 'deadline':
      return dayjs(event.due_date)
    case 'duration':
      return dayjs(event.start_date)
    case 'idea':
      return dayjs(event.created_at)
  }
}

/** 固定事件视图时间范围筛选：'all'（全部）/ '3'（3天内）/ '7'（7天内）。 */
const pinnedRange = ref<'all' | '3' | '7'>('all')
const pinRangeOptions = [
  { value: 'all' as const, label: '全部' },
  { value: '3' as const, label: '3天内' },
  { value: '7' as const, label: '7天内' },
]

/** 按所选时间范围对固定事件做可视化筛选：锚点日期落在「今天 → 今天+N天」区间内则保留。 */
const filteredPinnedEvents = computed<TimeEvent[]>(() => {
  if (pinnedRange.value === 'all') return pinnedEvents.value
  const ndays = Number(pinnedRange.value)
  const today = dayjs(props.todayKey).startOf('day')
  return pinnedEvents.value.filter((e) => {
    const anchor = pinnedAnchorDate(e)
    if (!anchor || !anchor.isValid()) return false
    const diff = anchor.startOf('day').diff(today, 'day')
    return diff >= 0 && diff <= ndays
  })
})

const {
  layout,
  isEditMode,
  draggingWidgetId,
  widgetStyle,
  computeCellMetrics,
  enterEditMode,
  exitEditMode,
  resetLayout,
  placeImageWidget,
  removeWidget,
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
    <input
      ref="fileInputRef"
      class="db-img-file-input"
      type="file"
      accept="image/*"
      hidden
      @change="onFileChange"
    />

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
      <!-- 内部横向分栏：日历 ≈ 2/3 | 事件总览 ≈ 1/3，同一水平布局，不改变 Widget 外部 2×2 尺寸 -->
      <div class="db-cal-split">
        <div class="db-cal-left">
          <CalendarView
            embedded
            @edit-event="emit('edit-event', $event)"
            @delete-event="emit('delete-event', $event)"
          />
        </div>
        <aside class="db-cal-overview" aria-label="事件总览">
          <div class="db-cal-overview-head">
            <span class="db-cal-overview-title">事件总览</span>
            <span v-if="props.events.length" class="db-cal-overview-count">
              {{ props.events.length }}
            </span>
          </div>
          <p v-if="!props.events.length" class="db-cal-overview-empty">
            当前日期暂无事件
          </p>
          <ul v-else class="db-cal-overview-list">
            <li
              v-for="e in props.events"
              :key="e.id"
              class="db-cal-overview-item"
              :title="`${e.title} · 点击编辑`"
              @click="emit('edit-event', e)"
            >
              <span class="db-cal-ov-time">{{ dayEventTimeLabel(e, props.todayKey) }}</span>
              <span class="db-cal-ov-title">{{ e.title }}</span>
            </li>
          </ul>
        </aside>
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
          <span v-if="pinnedEvents.length" class="db-pinned-mark" aria-label="已固定">固定</span>
          <div class="db-pinned-range" role="group" aria-label="时间范围筛选">
            <button
              v-for="opt in pinRangeOptions"
              :key="opt.value"
              type="button"
              class="db-pinned-range-seg"
              :class="{ active: pinnedRange === opt.value }"
              @click="pinnedRange = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
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
        <template v-for="pinnedEvent in filteredPinnedEvents" :key="pinnedEvent.id">
          <div
            class="db-pinned-card"
            :title="`${pinnedEvent.title} · 点击编辑`"
            @click="emit('edit-event', pinnedEvent)"
          >
            <!-- 左列：事件标题 + 取消固定（一一对应，位于本卡内部、标题下方） -->
            <div class="db-pinned-left">
              <span class="db-pinned-titlebtn">
                <span class="db-pinned-title">{{ pinnedEvent.title }}</span>
              </span>
              <button
                class="db-pinned-unpin"
                type="button"
                aria-label="取消固定"
                @click.stop="unpinEvent(pinnedEvent.id)"
              >
                取消固定
              </button>
            </div>

            <!-- 分割线：位置由左列内容宽度自适应，不写死固定比例 -->
            <div class="db-pinned-divider" aria-hidden="true"></div>

            <!-- 右列：固定事件具体内容（按事件类型显示合适信息） -->
            <div class="db-pinned-right">
              <div class="db-pinned-right-content">
                <div class="db-pinned-type-row">
                  <BaseBadge :color="props.typeColorByType[pinnedEvent.type] ?? 'var(--color-text-tertiary)'">
                    {{ props.typeLabelByType[pinnedEvent.type] ?? pinnedEvent.type }}
                  </BaseBadge>
                  <span
                    v-if="pinnedEvent.type !== 'idea'"
                    class="db-pinned-status"
                  >
                    {{ statusLabelByStatus[pinnedDisplayStatus(pinnedEvent)] ?? pinnedDisplayStatus(pinnedEvent) }}
                  </span>
                  <ToggleCompleteButton
                    v-if="pinnedEvent.type !== 'idea'"
                    :event="pinnedEvent"
                    class="db-pinned-toggle"
                    @click.stop
                  />
                </div>
                <div class="db-pinned-time">
                  {{ pinnedDateText(pinnedEvent) }} · {{ pinnedTimeText(pinnedEvent) }}
                </div>
                <div v-if="pinnedEvent.type === 'deadline'" class="db-pinned-extra">
                  优先级：{{ priorityLabelByPriority[pinnedEvent.priority] ?? pinnedEvent.priority }}
                </div>
                <p v-if="pinnedBodyText(pinnedEvent)" class="db-pinned-desc">{{ pinnedBodyText(pinnedEvent) }}</p>
                <div v-if="pinnedEvent.tags.length" class="db-pinned-tags">
                  <span v-for="tag in pinnedEvent.tags" :key="tag" class="db-pinned-tag">#{{ tag }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-if="filteredPinnedEvents.length === 0" class="db-pinned-empty">
          {{ pinnedEvents.length === 0 ? '暂无固定事件' : '所选范围内暂无固定事件' }}
        </div>

        <!-- 统一操作区：所有卡片下方，新增固定事件入口（不属于任何单张卡片） -->
        <div class="db-pinned-footer">
          <button
            class="db-pinned-select"
            type="button"
            @click="pinnedPickerVisible = true"
          >
            选择事件
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

    <section
      v-for="record in layoutImageWidgets"
      :key="record.id"
      class="db-widget db-widget--image"
      :class="{ 'is-dragging': draggingWidgetId === record.id }"
      :style="widgetStyle(record.id)"
      :aria-label="isEditMode ? '图片组件（可拖动）' : '图片组件'"
      @pointerdown.stop.prevent="isEditMode && onDragStart(record.id, $event)"
    >
      <img
        class="db-widget-image-img"
        :src="record.dataUrl"
        alt="图片组件"
        draggable="false"
      />
      <button
        v-if="isEditMode"
        class="db-img-delete"
        type="button"
        aria-label="删除图片组件"
        title="删除图片组件"
        @pointerdown.stop
        @click.stop="requestDeleteImage(record.id)"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </section>

    <div class="db-widget-actions" :class="{ 'is-editing': isEditMode }">
      <template v-if="isEditMode">
        <button
          class="db-widget-action"
          type="button"
          aria-label="添加组件"
          title="添加组件"
          @click="openAddPicker"
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

    <ComponentPickerModal
      :visible="pickerVisible"
      @cancel="pickerVisible = false"
      @select="onPickerSelect"
    />

    <ImageCropModal
      :visible="cropModalVisible"
      :image-data-url="cropSource"
      :target-ratio="cropRatio"
      @cancel="cropModalVisible = false"
      @confirm="onCropConfirm"
    />

    <ConfirmDialog
      :visible="deleteTargetId !== null"
      title="删除图片？"
      message="确定删除此图片吗？删除后将无法恢复。"
      confirm-text="删除"
      cancel-text="取消"
      :danger="true"
      @cancel="cancelDeleteImage"
      @confirm="confirmDeleteImage"
    />
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

/* ============ 日历 Widget 内部分栏：日历 ≈ 2/3 | 事件总览 ≈ 1/3 ============
 * 仅重新分配 Widget 内部空间；不改 Widget 外部 2×2 尺寸，不改日历数据/交互逻辑。 */
.db-cal-split {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 10px;
  padding: 2px 12px 12px;
}

/* —— 左列：日历占约 2/3 —— */
.db-cal-left {
  flex: 0 0 66.66%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* 让嵌入日历填满左列并压缩垂直空间，确保 42 格整格可见、无内部滚动 */
.db-cal-left :deep(.cal-embedded) {
  width: 100%;
  height: 100%;
  gap: 6px;
}
.db-cal-left :deep(.cal-header--embedded) {
  margin-bottom: 0;
}
.db-cal-left :deep(.cal-host) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.db-cal-left :deep(.mymemo-cal) {
  height: 100%;
  display: flex;
  flex-direction: column;
  --cal-cell-h: 26px; /* 作为最小行高下限；空间富余时由 flex 拉伸填满 */
}
.db-cal-left :deep(.mymemo-weekdays) {
  flex: 0 0 auto;
  margin-bottom: 5px;
  font-size: 9px;
}
.db-cal-left :deep(.vuecal) {
  flex: 1;
  min-height: 0;
  height: auto;
}
.db-cal-left :deep(.vuecal__body),
.db-cal-left :deep(.vuecal__weeks) {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.db-cal-left :deep(.vuecal__week) {
  flex: 1 1 0;
  min-height: 0;
}
.db-cal-left :deep(.vuecal__cell) {
  min-height: 0 !important;
}
.db-cal-left :deep(.vc-day-num) {
  width: 30px;
  height: 28px;
  font-size: 11px;
  border-radius: 9px;
}
/* 选中日期事件列表改由右侧「事件总览」承担；隐藏日历视图内嵌列表，避免纵向滚动溢出 */
.db-cal-left :deep(.day-events),
.db-cal-left :deep(.cal-dur-toggle-row) {
  display: none !important;
}

/* —— 右列：事件总览占约 1/3 —— */
.db-cal-overview {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 0 0 10px;
  border-left: 1px dashed color-mix(in srgb, var(--color-accent) 22%, var(--surface-border));
  overflow: hidden;
}
.db-cal-overview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex: 0 0 auto;
}
.db-cal-overview-title {
  font-size: 12px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.db-cal-overview-count {
  font-size: 10px;
  font-weight: var(--font-semibold);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  padding: 1.5px 7px;
  border-radius: 999px;
}
.db-cal-overview-empty {
  margin: 0;
  flex: 1;
  display: flex;
  align-items: center;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.db-cal-overview-list {
  list-style: none;
  margin: 0;
  padding: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.db-cal-overview-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  padding: 4px 6px;
  border-radius: 7px;
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}
.db-cal-overview-item:hover {
  background: var(--glass-bg-hover);
}
.db-cal-ov-time {
  flex: 0 0 auto;
  min-width: 34px;
  color: var(--color-text-tertiary);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.db-cal-ov-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-primary);
  font-size: 11px;
  font-weight: var(--font-medium);
}

/* 窗口过窄时 2×2 Widget 装不下「2/3 日历 + 1/3 总览」：隐藏总览，日历收回整宽，避免格宽塌缩。
 * 置于各基础规则之后，保证在层叠中覆盖 display:flex。 */
@media (max-width: 900px) {
  .db-cal-overview {
    display: none;
  }
  .db-cal-left {
    flex: 1 1 100%;
  }
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
  gap: 8px;
  padding: 4px 12px 12px;
}
/* —— 时间范围筛选（玻璃胶囊分段控件，保持 Dashboard 统一视觉）—— */
.db-pinned-range {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 2px;
  padding: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent-2) 8%, transparent);
  border: 1px solid var(--surface-border);
}
.db-pinned-range-seg {
  padding: 3px 8px;
  font-size: 10px;
  line-height: 1.2;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  white-space: nowrap;
}
.db-pinned-range-seg:hover {
  color: var(--color-text-secondary);
}
.db-pinned-range-seg.active {
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  color: var(--color-text-primary);
  font-weight: var(--font-semibold);
}
/* —— 左右结构卡片：左列宽由内容自适应，分割线随其右端定位（不写死比例）—— */
.db-pinned-card {
  display: flex;
  align-items: stretch;
  gap: 0;
  width: 100%;
  min-width: 0;
  flex: 1;
  padding: 12px;
  border: 1px solid var(--surface-border);
  border-radius: calc(var(--surface-radius) - 2px);
  background: color-mix(in srgb, var(--surface-bg) 82%, transparent);
  box-shadow: 0 2px 10px color-mix(in srgb, var(--color-primary) 6%, transparent);
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.db-pinned-card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--surface-border));
  background: color-mix(in srgb, var(--surface-bg) 92%, transparent);
  box-shadow: 0 3px 14px color-mix(in srgb, var(--color-primary) 10%, transparent);
}
.db-pinned-left {
  flex: 0 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 9px;
  padding-right: 12px;
}
.db-pinned-titlebtn {
  max-width: 100%;
  padding: 0;
  color: inherit;
  text-align: left;
}
.db-pinned-title {
  display: block;
  max-width: 220px;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: var(--font-semibold);
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--duration-fast) var(--ease-out);
}
.db-pinned-divider {
  flex: 0 0 1px;
  align-self: stretch;
  background: color-mix(in srgb, var(--color-accent) 22%, var(--surface-border));
}
.db-pinned-right {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  padding-left: 12px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  overflow: hidden;
}
.db-pinned-right-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  max-height: 100%;
  overflow: hidden;
}
.db-pinned-type-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.db-pinned-status {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-tertiary);
  font-size: 9px;
}
.db-pinned-time {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-secondary);
  font-size: 10px;
}
.db-pinned-extra {
  color: var(--color-text-tertiary);
  font-size: 10px;
}
.db-pinned-desc {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 10px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.db-pinned-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.db-pinned-tag {
  display: inline-block;
  padding: 1px 7px;
  font-size: 9px;
  border-radius: 999px;
  background: var(--color-accent-2-soft);
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
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
/* —— 卡片下方统一操作区：新增固定事件入口。
   右端与卡片内缩（12px）对齐，使「选择事件」按钮与卡片右列内容（含已完成切换按钮）右端齐平。 */
.db-pinned-footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
  padding-right: 12px;
}
/* —— 完成状态切换按钮：贴在类型/状态行的最右侧 —— */
.db-pinned-toggle {
  margin-left: auto;
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

/* ---------------- 图片小组件 ---------------- */
/* 普通状态 = 纯图片展示块：无标题、无边框、无操作栏 */
.db-widget--image {
  position: relative; /* 容纳右下角悬浮删除按钮 */
  padding: 0;
  overflow: hidden;
  background: transparent;
  border: 0;
}
.db-widget-image-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover; /* 已按组件比例裁剪 → cover 恰好铺满、不变形 */
  border-radius: var(--surface-radius);
  user-select: none;
  -webkit-user-drag: none;
  touch-action: none;
}
/* 编辑模式下：右下角小型红色方块删除按钮，悬浮、置顶、不紧贴边缘 */
.db-img-delete {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 10;
  width: 22px;
  height: 22px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 5px;
  background: color-mix(in srgb, var(--color-danger) 88%, #000);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.28);
  transition:
    background var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.db-img-delete:hover {
  background: var(--color-danger);
  transform: scale(1.06);
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

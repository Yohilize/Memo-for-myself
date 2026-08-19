<script setup lang="ts">
/**
 * EventsView — 事件全览页面（/events）。
 *
 * 汇总 calendar / deadline / duration 三类时间管理事件，按时间顺序形成统一时间线。
 * idea 灵感事件不进入事件全览（灵感有独立 /ideas 页面与归档机制）。
 *
 * 数据链路：完全复用现有 Pinia → Service → Repository → IndexedDB 链路
 *   · Store：useEventStore（events 直接拿到全部事件）
 *   · CRUD：复用 @calendar/EventForm + BaseConfirmDialog（新增 / 编辑 / 删除）
 *   · 视觉与 Dashboard / Ideas 保持一致（同套玻璃面板 + AppSidebar + Design Token）
 */
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseConfirmDialog from '@/components/base/BaseConfirmDialog.vue'
import EventForm from '@calendar/EventForm.vue'
import { useEventStore } from '@/stores/eventStore'
import type { TimeEvent } from '@/types/event'
import type { CreateEventInput, UpdateEventInput } from '@/services/eventTypes'

const eventStore = useEventStore()

const typeLabelByType: Record<string, string> = {
  calendar: '行程',
  deadline: 'Deadline',
  duration: '时间块',
  idea: '灵感',
}
const typeColorByType: Record<string, string> = {
  calendar: 'var(--color-event-calendar)',
  deadline: 'var(--color-event-deadline)',
  duration: 'var(--color-event-duration)',
  idea: 'var(--color-event-idea)',
}
const statusLabelByStatus: Record<string, string> = {
  pending: '待办',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
}

/** 状态徽章颜色：completed 绿色、cancelled 弱化、其余用主色 */
function statusBadgeColor(status: string): string {
  if (status === 'completed') return 'var(--color-success)'
  if (status === 'cancelled') return 'var(--color-text-tertiary)'
  return 'var(--color-primary)'
}

/** 事件 → 时间线排序键（字符串，可直接 localeCompare 升序） */
function timelineSortKey(e: TimeEvent): string {
  switch (e.type) {
    case 'calendar':
      return `${e.event_date}T${e.all_day ? '00:00' : e.event_time || '00:00'}:00`
    case 'deadline':
      return e.due_date
    case 'duration':
      return `${e.start_date}T00:00:00`
    case 'idea':
      return ''
  }
}

/** 事件归属的日期（YYYY-MM-DD），用于按天分组 */
function timelineDayKey(e: TimeEvent): string {
  switch (e.type) {
    case 'calendar':
      return e.event_date
    case 'deadline':
      return dayjs(e.due_date).format('YYYY-MM-DD')
    case 'duration':
      return dayjs(e.start_date).format('YYYY-MM-DD')
    case 'idea':
      return ''
  }
}

/** 事件行的时间说明文字 */
function timeLabel(e: TimeEvent): string {
  switch (e.type) {
    case 'calendar':
      return e.all_day ? '全天' : e.event_time || '未设置时间'
    case 'deadline': {
      const d = dayjs(e.due_date)
      return d.isValid() && (d.hour() !== 0 || d.minute() !== 0)
        ? `截止 ${d.format('HH:mm')}`
        : '截止'
    }
    case 'duration': {
      const s = dayjs(e.start_date)
      if (!s.isValid()) return '时间块'
      // 无结束日期：已开始、未定结束 → 「进行中」
      if (!e.end_date) return '进行中'
      const t = dayjs(e.end_date)
      if (!t.isValid()) return '时间块'
      return `${s.format('M月D日')}–${t.format('M月D日')}`
    }
    case 'idea':
      return ''
  }
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 日期分组标题：今天/明天/昨天做相对提示 */
function dayHeaderLabel(dayKey: string): string {
  const d = dayjs(dayKey)
  const now = dayjs()
  if (!d.isValid()) return dayKey
  if (d.isSame(now, 'day')) return `今天 · ${d.format('M月D日')}`
  if (d.isSame(now.add(1, 'day'), 'day')) return `明天 · ${d.format('M月D日')}`
  if (d.isSame(now.subtract(1, 'day'), 'day')) return `昨天 · ${d.format('M月D日')}`
  const weekday = `周${WEEKDAYS[d.day()]}`
  if (d.isSame(now, 'year')) return `${d.format('M月D日')} · ${weekday}`
  return `${d.format('YYYY年M月D日')} · ${weekday}`
}

/** 时间线：排除 idea → 按时间升序 → 按天分组 */
const dayGroups = computed(() => {
  const all = (eventStore.events ?? []).filter((e) => e.type !== 'idea')
  const sorted = [...all].sort((a, b) => timelineSortKey(a).localeCompare(timelineSortKey(b)))
  const groups: { dayKey: string; events: TimeEvent[] }[] = []
  for (const e of sorted) {
    const dayKey = timelineDayKey(e)
    const last = groups[groups.length - 1]
    if (last && last.dayKey === dayKey) last.events.push(e)
    else groups.push({ dayKey, events: [e] })
  }
  return groups
})

/** 头部统计：总数 + 分类型数量（不含 idea） */
const timelineStats = computed(() => {
  const all = (eventStore.events ?? []).filter((e) => e.type !== 'idea')
  return {
    total: all.length,
    calendar: all.filter((e) => e.type === 'calendar').length,
    deadline: all.filter((e) => e.type === 'deadline').length,
    duration: all.filter((e) => e.type === 'duration').length,
  }
})

/* ==============================================================================
 *  CRUD UI：新增 / 编辑 / 删除（复用 EventForm 弹窗 + BaseConfirmDialog）
 * ============================================================================== */
const formVisible = ref(false)
const editingEvent = ref<TimeEvent | null>(null)
const deleteTarget = ref<TimeEvent | null>(null)

function openNew() {
  editingEvent.value = null
  formVisible.value = true
}
function openEdit(e: TimeEvent) {
  editingEvent.value = e
  formVisible.value = true
}
function requestDelete(e: TimeEvent) {
  deleteTarget.value = e
}
function cancelDelete() {
  deleteTarget.value = null
}
async function confirmDelete() {
  const e = deleteTarget.value
  if (!e) return
  deleteTarget.value = null
  try {
    await eventStore.remove(e.id)
    if (editingEvent.value?.id === e.id) editingEvent.value = null
  } catch (_err) {
    /* eventStore.error 已持有 */
  }
}
async function handleSubmitCreate(input: CreateEventInput) {
  try {
    // idea 也可经此创建（走同一数据链路），但时间线会过滤掉 idea，因此创建后归入 /ideas
    await eventStore.create(input)
    formVisible.value = false
  } catch (_err) {
    /* eventStore.error 已持有 */
  }
}
async function handleSubmitUpdate(id: string, patch: UpdateEventInput) {
  try {
    await eventStore.update(id, patch)
    formVisible.value = false
    editingEvent.value = null
  } catch (_err) {
    /* eventStore.error 已持有 */
  }
}

onMounted(() => {
  eventStore.loadAll()
})
</script>

<template>
  <div class="events-root">
    <section class="events-glass" aria-label="事件全览">
      <AppSidebar active-path="/events" />
      <main class="events-content">
        <!-- ===== 页面头：标题 + 统计 + 新增 ===== -->
        <header class="events-head">
          <div class="events-head-left">
            <div class="events-title">📋 事件全览</div>
            <div class="events-sub">
              共 <strong>{{ timelineStats.total }}</strong> 条 ·
              日历 <strong>{{ timelineStats.calendar }}</strong> ·
              Deadline <strong>{{ timelineStats.deadline }}</strong> ·
              时间块 <strong>{{ timelineStats.duration }}</strong>
            </div>
          </div>
          <div class="events-head-right">
            <BaseButton variant="primary" size="sm" @click="openNew">
              + 新增事件
            </BaseButton>
          </div>
        </header>

        <!-- ===== 空状态 ===== -->
        <div v-if="dayGroups.length === 0" class="events-empty">
          <div class="events-empty-ic" aria-hidden="true">🗓️</div>
          <div class="events-empty-title">还没有时间事件</div>
          <div class="events-empty-sub">
            行程、Deadline、时间块会按时间顺序汇总在这里。<br />
            点击右上角「新增事件」开始规划吧。
          </div>
        </div>

        <!-- ===== 时间线：按天分组，天内在按时间升序 ===== -->
        <div v-else class="timeline">
          <section v-for="group in dayGroups" :key="group.dayKey" class="tl-day">
            <header class="tl-day-head">
              <span class="tl-day-label">{{ dayHeaderLabel(group.dayKey) }}</span>
              <span class="tl-day-count">{{ group.events.length }} 项</span>
            </header>
            <div class="tl-day-list">
              <div
                v-for="e in group.events"
                :key="e.id"
                class="tl-event"
                :style="{ '--c': typeColorByType[e.type] ?? 'var(--color-text-tertiary)' }"
                :title="`${typeLabelByType[e.type] ?? e.type} · 点击编辑`"
                @click="openEdit(e)"
              >
                <span class="tl-event-dot"></span>
                <div class="tl-event-body">
                  <div class="tl-event-title-row">
                    <span class="tl-event-title">{{ e.title }}</span>
                    <BaseBadge
                      v-if="e.type !== 'idea' && e.status"
                      :color="statusBadgeColor(e.status)"
                      variant="soft"
                    >{{ statusLabelByStatus[e.status] }}</BaseBadge>
                  </div>
                  <div class="tl-event-meta">
                    <BaseBadge :color="typeColorByType[e.type]">
                      {{ typeLabelByType[e.type] ?? e.type }}
                    </BaseBadge>
                    <span class="tl-event-time">{{ timeLabel(e) }}</span>
                    <span v-if="e.tags && e.tags.length" class="tl-event-tags">
                      <span v-for="tag in e.tags" :key="tag" class="tl-event-tag">#{{ tag }}</span>
                    </span>
                  </div>
                </div>
                <div class="tl-event-actions" @click.stop>
                  <button
                    class="tl-act-btn"
                    title="编辑"
                    @click="openEdit(e)"
                  >✏️</button>
                  <button
                    class="tl-act-btn danger"
                    title="删除"
                    @click="requestDelete(e)"
                  >🗑️</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </section>
  </div>

  <!-- ===== CRUD 弹窗 ===== -->
  <EventForm
    v-model:visible="formVisible"
    default-type="calendar"
    :editing-event="editingEvent"
    @submit-create="handleSubmitCreate"
    @submit-update="handleSubmitUpdate"
    @delete="(id) => {
      const e = eventStore.events.find((x) => x.id === id)
      if (e) requestDelete(e)
    }"
  />
  <BaseConfirmDialog
    :visible="!!deleteTarget"
    :event-title="deleteTarget?.title ?? ''"
    @cancel="cancelDelete"
    @confirm="confirmDelete"
  />
</template>

<style scoped>
/* ===== 外层容器：完全镜像 DashboardView / IdeasView 的玻璃面板结构 ===== */
.events-root {
  position: relative;
  width: 100%;
  min-height: 100vh;
  padding: 36px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}
.events-glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  width: min(100%, var(--app-width, 960px));
  max-width: calc(100% - 0px);
  min-width: 360px;
  height: min(84vh, 820px);
  border-radius: var(--glass-radius);
  display: flex;
  overflow: hidden;
}
.events-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ===== 页面头 ===== */
.events-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.events-head-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.events-title {
  font-size: 18px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  line-height: 1.4;
  background: var(--gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.events-sub {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.events-sub strong {
  color: var(--color-text-secondary);
  font-weight: var(--font-semibold);
  margin: 0 2px;
}
.events-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* ===== 空状态 ===== */
.events-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  padding: 40px 20px;
}
.events-empty-ic {
  font-size: 36px;
  opacity: 0.85;
  margin-bottom: 8px;
}
.events-empty-title {
  font-size: 14px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.events-empty-sub {
  font-size: 11px;
  color: var(--color-text-tertiary);
  max-width: 320px;
  line-height: 1.6;
}

/* ===== 时间线 ===== */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tl-day {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tl-day-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed color-mix(in srgb, var(--color-accent) 20%, var(--glass-border));
}
.tl-day-label {
  font-size: 13px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.tl-day-count {
  font-size: 10px;
  font-weight: var(--font-semibold);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  padding: 1.5px 7px;
  border-radius: 999px;
}
.tl-day-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* —— 事件行：类型色条 + 时间 + 类型徽章 + 状态 —— */
.tl-event {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
  padding: 10px 12px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-left: 3px solid var(--c);
  border-radius: 10px;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.tl-event:hover,
.tl-event:focus-within {
  background: var(--glass-bg-hover);
  border-color: color-mix(in srgb, var(--color-primary) 18%, var(--surface-border));
  transform: translateX(2px);
}
.tl-event-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--c);
}
.tl-event-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tl-event-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.tl-event-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.tl-event-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.tl-event-time {
  font-size: 10px;
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}
.tl-event-tags {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.tl-event-tag {
  padding: 1px 7px;
  font-size: 9px;
  border-radius: 999px;
  background: var(--color-accent-2-soft);
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
}
.tl-event-actions {
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
.tl-event:hover .tl-event-actions,
.tl-event:focus-within .tl-event-actions {
  opacity: 1;
  transform: translateX(0);
}
.tl-act-btn {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.tl-act-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
}
.tl-act-btn.danger:hover {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger-light);
  border-color: color-mix(in srgb, var(--color-danger) 28%, transparent);
}

/* ===== 响应式 ===== */
@media (max-width: 680px) {
  .events-root { padding: var(--space-4); min-height: 100vh; }
  .events-glass {
    height: 88vh;
    border-radius: calc(var(--glass-radius) - 4px);
  }
  .events-content { padding: 16px; gap: 14px; }
}
</style>

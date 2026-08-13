<script setup lang="ts">
import VueCal from 'vue-cal'
import 'vue-cal/dist/vuecal.css'
import dayjs from 'dayjs'
import { computed, onMounted, ref } from 'vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { useEventStore } from '@/stores/eventStore'
import { mapEventsToDateIndicators, filterEventsForDay, dayEventTimeLabel, dayEventSortKey } from '@/services/eventCalendarMapper'
import type { TimeEvent } from '@/types/event'

const eventStore = useEventStore()

/** 当前显示的月份（任意日期在这个月都可；内部用 dayjs 月初锚定） */
const viewDate = ref<Date>(new Date())
/** 选中日期（点击后输出；今天高亮另外做，不依赖 selected） */
const selectedDate = ref<Date | null>(new Date())

/** vue-cal 4.x options：
 *  - activeView: 'month' → 42 格月视图（vue-cal v4 prop 名：activeView，不是 view）
 *  - titleBar / todayButton / viewsBar / time: false → 关闭默认工具栏/切换按钮/时间列，头部 & 动作完全由 MYMEMO 自管
 *  - eventsOnMonthView: false → 不在月格内渲染大块 Event Card
 *  - editableEvents: false → 不允许默认拖建事件
 *  - startWeekOnSunday: false → 周一起始
 */
const calOptions = {
  activeView: 'month',
  titleBar: false,
  todayButton: false,
  viewsBar: false,
  time: false,
  eventsOnMonthView: false,
  editableEvents: false,
  clickToNavigate: false,
  startWeekOnSunday: false,
  eventCount: false,
  datePicker: false,
  currentTimeLabel: false,
  schedules: [],
} as const

const titleText = computed(() => dayjs(viewDate.value).format('YYYY 年 M 月'))

/** 事件日期→indicator 字典（数据源：Pinia eventStore） */
const indicators = computed(() =>
  mapEventsToDateIndicators(eventStore.events ?? []),
)

/** 选中日期 → YYYY-MM-DD 键，用于按天查事件 */
const selectedDayKey = computed<string | null>(() =>
  selectedDate.value ? dayjs(selectedDate.value).format('YYYY-MM-DD') : null,
)

/**
 * 选中日期当天的事件列表（与 indicator 数据源解耦；
 * 筛选 + 时间提取逻辑放在 service 层，UI 只做显示排序）。
 */
const eventsForSelectedDay = computed<TimeEvent[]>(() => {
  if (!selectedDayKey.value) return []
  const list = filterEventsForDay(eventStore.events ?? [], selectedDayKey.value)
  return [...list].sort(
    (a, b) =>
      dayEventSortKey(a, selectedDayKey.value!).localeCompare(
        dayEventSortKey(b, selectedDayKey.value!),
      ),
  )
})

/** 当天事件中文类型名（作为 aria-label / title / tooltip 用途） */
const typeLabelByType: Record<string, string> = {
  calendar: '日历事件',
  deadline: 'Deadline',
  duration: '时间块',
  idea: '灵感',
}

function prevMonth() {
  viewDate.value = dayjs(viewDate.value).subtract(1, 'month').toDate()
}
function nextMonth() {
  viewDate.value = dayjs(viewDate.value).add(1, 'month').toDate()
}
function goToday() {
  const today = new Date()
  viewDate.value = today
  selectedDate.value = today
}

/** vue-cal 月视图单元格点击 → 更新选中日期 */
function onCellClick(cell: { date: Date }) {
  selectedDate.value = cell.date
}

const todayKey = dayjs().format('YYYY-MM-DD')

/** 按类型取 dot 颜色（全部来源于 tokens.css 语义变量，不硬编码具体色） */
const dotVarByType: Record<string, string> = {
  calendar: 'var(--color-event-calendar)',
  deadline: 'var(--color-event-deadline)',
  duration: 'var(--color-event-duration)',
  idea: 'var(--color-event-idea)',
}

function orderedTypes(dKey: string): string[] {
  const ind = indicators.value[dKey]
  if (!ind) return []
  const order: string[] = ['deadline', 'duration', 'calendar', 'idea']
  return order.filter((t) => ind.byType[t as never] > 0)
}

onMounted(() => {
  // 数据读取链路：UI → Pinia（eventStore）→ eventService → DexieEventRepository → IndexedDB
  eventStore.loadAll()
})
</script>

<template>
  <div class="calendar-page">
    <BaseCard padding="lg" class="calendar-wrap">
      <!-- 自定义头部（不使用 vue-cal 默认 toolbar，MYMEMO 风格完全自管） -->
      <div class="cal-header">
        <div class="cal-nav-left">
          <BaseButton variant="ghost" size="sm" @click="prevMonth">‹</BaseButton>
          <h2 class="cal-title">{{ titleText }}</h2>
          <BaseButton variant="ghost" size="sm" @click="nextMonth">›</BaseButton>
        </div>
        <BaseButton variant="secondary" size="sm" @click="goToday">今天</BaseButton>
      </div>

      <div class="cal-selected-hint" v-if="selectedDate">
        <span class="hint-label">已选日期</span>
        <span class="hint-date">{{ dayjs(selectedDate).format('YYYY-MM-DD dddd') }}</span>
      </div>

      <!--
        vue-cal 负责：日期计算 / 周起始 / 跨月填充 / 选中态定位
        我们自管：视觉样式（覆盖 vuecal 默认皮肤）+ 事件 indicator（小圆点）+ 头部 + 点击
        传空 events，避免 vue-cal 默认渲染大块 Event Card。
      -->
      <div class="mymemo-cal">
        <VueCal
          v-bind="calOptions"
          :events="[]"
          :view-date="viewDate"
          :selected-date="selectedDate ?? undefined"
          locale="zh-cn"
          @cell-click="onCellClick"
          @update:view-date="(d: Date) => (viewDate = d)"
          @update:selected-date="(d: Date | '') => (selectedDate = (d === '' ? null : d))"
        >
          <!--
            vue-cal v4 单元格 slot：#cell-content = { cell, view, goNarrower, events }。
            cell 对象字段：
              cell.content       → 日期数字（1-31），直接显示
              cell.formattedDate → 'YYYY-MM-DD'，用于匹配 indicators 字典 & today 判断
              cell.today         → 是否当天（bool）
              cell.outOfScope    → 是否跨月（bool，即其他月份填充日期）
              cell.startDate     → 当日起始（Date/ISO 字符串，兜底备用）
          -->
          <template #cell-content="{ cell }">
            <div class="vc-cell-inner">
              <span
                class="vc-day-num"
                :class="{
                  'is-today': cell.formattedDate === todayKey || cell.today,
                  'is-weekday-outside': cell.outOfScope,
                }"
              >
                {{ cell.content }}
              </span>
              <div
                class="vc-indicators"
                v-if="indicators[cell.formattedDate]?.hasEvent"
              >
                <span
                  v-for="t in orderedTypes(cell.formattedDate).slice(0, 3)"
                  :key="t"
                  class="vc-dot"
                  :style="{ backgroundColor: dotVarByType[t] }"
                  :title="t"
                ></span>
              </div>
            </div>
          </template>
        </VueCal>
      </div>

      <!-- 选中日期 → 当天事件列表 -->
      <div class="day-events" v-if="selectedDayKey">
        <div class="day-events-head">
          <span class="day-events-date">
            {{ dayjs(selectedDayKey).format('M 月 D 日') }}
            <small class="day-events-weekday">
              {{ dayjs(selectedDayKey).format('dddd') }}
            </small>
          </span>
          <span class="day-events-count" v-if="eventsForSelectedDay.length">
            {{ eventsForSelectedDay.length }} 项
          </span>
        </div>

        <div class="day-events-list" v-if="eventsForSelectedDay.length">
          <div
            v-for="e in eventsForSelectedDay"
            :key="e.id"
            class="day-event-row"
            :title="typeLabelByType[e.type]"
          >
            <span
              class="day-event-type-dot"
              :style="{ backgroundColor: dotVarByType[e.type] }"
              :aria-label="typeLabelByType[e.type]"
            ></span>
            <span class="day-event-time">
              {{ dayEventTimeLabel(e, selectedDayKey) }}
            </span>
            <span class="day-event-title">{{ e.title }}</span>
          </div>
        </div>

        <div class="day-events-empty" v-else>
          <span class="empty-icon" aria-hidden="true">·</span>
          <span class="empty-text">今天还没有安排</span>
        </div>
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.calendar-page {
  height: 100%;
  padding: var(--space-6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.calendar-wrap {
  width: min(100%, 920px);
}

.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}
.cal-nav-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.cal-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  letter-spacing: 0.02em;
  margin: 0 4px;
}
.cal-selected-hint {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--accent-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--surface-radius);
  margin-bottom: var(--space-4);
}
.hint-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}
.hint-date {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

/* ====== 覆盖 vue-cal 默认皮肤：全部使用语义 Design Token，零硬编码色 ====== */
.mymemo-cal :deep(.vuecal) {
  background: transparent;
  color: var(--color-text-primary);
  font-family: inherit;
  --vuecal-primary-color: var(--color-primary);
  --vuecal-primary-color-rgb: var(--color-primary);
  --vuecal-border-color: var(--surface-border-soft);
  --vuecal-background-color: transparent;
  --vuecal-cell-color: var(--color-text-primary);
  --vuecal-cell-disabled-color: var(--color-text-tertiary);
  --vuecal-cell-selected-background-color: var(--accent-soft);
  --vuecal-cell-hover-background-color: var(--glass-bg-hover);
}
/* vue-cal v4 的默认 header（含 prev/next/月标题）和 viewsBar 都在 prop 里关了，保险再隐藏 */
.mymemo-cal :deep(.vuecal__header),
.mymemo-cal :deep(.vuecal__views-bar),
.mymemo-cal :deep(.vuecal__toolbar) {
  display: none !important;
}
/* 月视图带时间列的标志（在非 month 时才出现）强制不显示 */
.mymemo-cal :deep(.vuecal--view-with-time .vuecal__body) {
  margin-left: 0;
}
.mymemo-cal :deep(.vuecal__time-column) {
  display: none;
}
/* 周标题栏（Mon/Tue/...） */
.mymemo-cal :deep(.vuecal__weekdays-headings) {
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border-bottom: 1px solid var(--surface-border);
  padding-bottom: 6px;
  margin-bottom: 4px;
}
.mymemo-cal :deep(.vuecal__weekday-heading) {
  border: none;
  background: transparent;
  color: inherit;
  font-size: inherit;
  padding: 6px 4px;
}
/* 行/单元格外框：用 soft surface border，不使用默认的深灰粗线 */
.mymemo-cal :deep(.vuecal__body) {
  border: none;
}
.mymemo-cal :deep(.vuecal__week) {
  border: none;
  min-height: 86px;
}
.mymemo-cal :deep(.vuecal__cell) {
  background: transparent;
  border: 1px solid transparent;
  border-right-color: color-mix(in srgb, var(--color-primary) 6%, transparent);
  border-bottom-color: color-mix(in srgb, var(--color-primary) 6%, transparent);
  transition: background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}
.mymemo-cal :deep(.vuecal__week .vuecal__cell:last-child) {
  border-right-color: transparent;
}
.mymemo-cal :deep(.vuecal__week:last-child .vuecal__cell) {
  border-bottom-color: transparent;
}
/* 选中态（v4 真实类名：vuecal__cell--selected） */
.mymemo-cal :deep(.vuecal__cell.vuecal__cell--selected) {
  background: var(--color-accent-soft);
  border-color: var(--color-primary-light);
  border-radius: 10px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary-light) 60%, transparent),
    0 6px 20px color-mix(in srgb, var(--color-primary-light) 32%, transparent);
}
/* Hover（仅当月日期；v4 真实跨月类名：vuecal__cell--out-of-scope） */
.mymemo-cal :deep(.vuecal__cell:not(.vuecal__cell--out-of-scope):hover) {
  background: var(--glass-bg-hover);
  border-radius: 10px;
}
/* 跨月日期淡化（单元格整体） */
.mymemo-cal :deep(.vuecal__cell.vuecal__cell--out-of-scope) {
  background: transparent;
  opacity: 1;
}
/* 今天单元格底色：弱化，交给内层的渐变圈突出（选中优先覆盖） */
.mymemo-cal :deep(.vuecal__cell.vuecal__cell--today) {
  background: color-mix(in srgb, var(--color-primary-light) 12%, transparent);
  border-radius: 10px;
}

/* 我们自己的 cell 内部结构 */
.vc-cell-inner {
  width: 100%;
  height: 100%;
  min-height: 80px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 4px;
  box-sizing: border-box;
}
.vc-day-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  border-radius: 50%;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}
.vc-day-num.is-today {
  background: var(--gradient-primary);
  color: var(--color-text-on-gradient);
  font-weight: var(--font-semibold);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.vc-day-num.is-weekday-outside {
  color: var(--color-text-tertiary);
}
.vc-day-num.is-weekday-outside.is-today {
  color: var(--color-text-on-gradient); /* 今日仍然保持渐变白字 */
}

.vc-indicators {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 4px;
}
.vc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 20%, transparent);
}

/* vue-cal 默认事件容器：隐藏，避免未来即使误传 events 也渲染大块卡 */
.mymemo-cal :deep(.vuecal__cell-events) {
  display: none;
}
.mymemo-cal :deep(.vuecal__cell-content) {
  padding: 0;
}

/* ---------- 选中日期 → 当天事件列表 ---------- */
.day-events {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--surface-border);
}
.day-events-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--space-3);
  padding: 0 var(--space-1);
}
.day-events-date {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.day-events-weekday {
  margin-left: 6px;
  font-size: var(--text-xs);
  font-weight: var(--font-regular);
  color: var(--color-text-tertiary);
}
.day-events-count {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.day-events-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.day-event-row {
  display: grid;
  grid-template-columns: 12px 68px 1fr;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 10px;
  border-radius: 10px;
  transition: background var(--duration-fast) var(--ease-out);
}
.day-event-row:hover {
  background: var(--glass-bg-hover);
}
.day-event-type-dot {
  justify-self: center;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 0 1px
    color-mix(in srgb, currentColor 20%, transparent);
}
.day-event-time {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-medium);
}
.day-event-title {
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  font-weight: var(--font-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-events-empty {
  padding: var(--space-5) var(--space-1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-text-tertiary);
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-primary) 4%, transparent);
}
.empty-icon {
  font-size: 20px;
  line-height: 1;
  opacity: 0.5;
}
.empty-text {
  font-size: var(--text-sm);
}
</style>

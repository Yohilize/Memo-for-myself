<script setup lang="ts">
import VueCal from 'vue-cal'
import 'vue-cal/dist/vuecal.css'
import dayjs from 'dayjs'
import { computed, onMounted, ref } from 'vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { useEventStore } from '@/stores/eventStore'
import {
  mapEventsToDateIndicators,
  filterEventsForDay,
  dayEventTimeLabel,
  dayEventSortKey,
} from '@/services/eventCalendarMapper'
import type { TimeEvent } from '@/types/event'

/**
 * CalendarView 可在两种模式下使用：
 *  · embedded=false（默认）：独立页模式 `/calendar` —— 外层带 BaseCard + 页边距，作为完整页面。
 *  · embedded=true：嵌入模式（Dashboard 等宿主）—— 去掉外层卡片、页面级 padding 和冗余"日历"标题，
 *                    只保留月份导航、42 格网格和选中日期事件列表。
 * 任何模式下业务逻辑（点击/月份切换/Today 高光/Event Store）完全一致。
 *
 * 模板结构：两种模式分别展开，避免同文件多 script / 子组件的 Vue 编译陷阱。
 * 逻辑完全共享（同一个 setup），只是外层容器和 cal-header 的左标识有差异。
 */
const props = defineProps<{
  embedded?: boolean
}>()

const embedded = computed(() => !!props.embedded)
const eventStore = useEventStore()

/** 当前显示月份：MYMEMO 内部计算视图月标题 + Today 高光条件的辅助状态。
 *  注：Vue Cal 4.x 实际上不存在 viewDate prop；此处只做内部状态，不传给 Vue Cal。
 */
const viewDate = ref<Date>(dayjs().startOf('month').toDate())
const viewDateKey = computed(() => dayjs(viewDate.value).format('YYYY-MM'))

/** 当前选中日期：MYMEMO 唯一真源；**单向绑定**。
 *  只通过 @cell-click 更新；不接受 VueCal 通过 @update:selected-date 回写，
 *  避免"回写 → prop 感知更新 → 再回写"的循环更新。
 */
const selectedDateKey = ref<string>(dayjs().format('YYYY-MM-DD'))

/** 顶部年月标题：基于 viewDate，避免跨月选中时标题乱跳 */
const titleText = computed(() =>
  dayjs(viewDate.value).format('YYYY 年 M 月'),
)

/** 设置视图月（按月份对齐到 1 号） */
function setViewMonth(raw: Date | string | dayjs.Dayjs) {
  const target = dayjs(raw).startOf('month')
  if (!target.isValid()) return
  if (target.format('YYYY-MM') === viewDateKey.value) return
  viewDate.value = target.toDate()
}
function prevMonth() {
  setViewMonth(dayjs(viewDate.value).subtract(1, 'month'))
}
function nextMonth() {
  setViewMonth(dayjs(viewDate.value).add(1, 'month'))
}
function goToday() {
  const today = dayjs()
  setViewMonth(today)
  const todayK = today.format('YYYY-MM-DD')
  if (todayK !== selectedDateKey.value) selectedDateKey.value = todayK
}

const calOptions = {
  view: 'month' as const,
  hideViews: true,
  disableMonthEventOrganizer: true,
  weeksStartOnMonday: true,
  cellHeight: 56,
  spacing: 6,
}

/** 事件 → 按日期聚合的轻量指标 */
const indicators = computed(() =>
  mapEventsToDateIndicators(eventStore.events ?? []),
)

const todayKey = dayjs().format('YYYY-MM-DD')
const todayMonthKey = dayjs().format('YYYY-MM')
/** 当前视图显示今天所在月份 → Today 高光才显示 */
const isShowingCurrentMonth = computed(
  () => viewDateKey.value === todayMonthKey,
)

/** 给 vue-cal 的 :selected-date 喂 Date 对象；
 *  ⚠️ Vue Cal 4.x 无独立 viewDate prop；只能靠 selectedDate prop 变化 → watch.selectedDate → updateSelectedDate → switchView 重建 42 格。
 */
const selectedDateForVueCal = computed<Date>(() => {
  const selectedDj = dayjs(selectedDateKey.value)
  const selectedMonth = selectedDj.isValid()
    ? selectedDj.format('YYYY-MM')
    : ''
  if (selectedMonth === viewDateKey.value) {
    return selectedDj.startOf('day').toDate()
  }
  // 浏览其他月：返回视图月首日 → 强制触发 switchView 重建正确月
  return dayjs(viewDate.value).startOf('month').toDate()
})

/** 选中日期当天的事件列表（排序后给模板） */
const eventsForSelectedDay = computed<TimeEvent[]>(() => {
  const key = selectedDateKey.value
  const all = filterEventsForDay(eventStore.events ?? [], key)
  return [...all].sort((a, b) =>
    dayEventSortKey(a, key).localeCompare(dayEventSortKey(b, key)),
  )
})

const typeLabelByType: Record<string, string> = {
  calendar: '日历事件',
  deadline: 'Deadline',
  duration: '时间块',
  idea: '灵感',
}

/**
 * 统一入口：设置选中日期；若跨月则同步跳转到目标月。
 *  ⚠️ Vue Cal 4.x 无独立 viewDate prop；跨月必须同步更新 viewDate，
 *     保证 selectedDateForVueCal 在同一响应式 tick 里算出目标月份锚点，触发 switchView。
 */
function setSelectedDate(raw: Date | string | null | undefined) {
  const dj = raw ? dayjs(raw) : dayjs()
  if (!dj.isValid()) return
  const key = dj.format('YYYY-MM-DD')
  if (key === selectedDateKey.value) return
  const targetMonth = dj.format('YYYY-MM')
  if (viewDateKey.value !== targetMonth) {
    setViewMonth(dj)
  }
  selectedDateKey.value = key
}

function onCellClick(payload: unknown) {
  if (payload instanceof Date) {
    setSelectedDate(payload)
    return
  }
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    if (obj.date instanceof Date) {
      setSelectedDate(obj.date)
      return
    }
    if (typeof obj.formattedDate === 'string') {
      setSelectedDate(obj.formattedDate as string)
    }
  }
}

/** dot 颜色：全部走 tokens.css 语义变量 */
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
  eventStore.loadAll()
})
</script>

<template>
  <!-- ============ 独立页模式 /calendar：页面级 padding + 一张 BaseCard ============ -->
  <div v-if="!embedded" class="calendar-page">
    <BaseCard padding="md" class="calendar-wrap">
      <!-- 自定义头部：左"日历"标识 + 右月份控件；全部自管，不使用 VueCal 默认 toolbar -->
      <div class="cal-header">
        <div class="cal-nav-left">
          <svg class="cal-ic" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/></svg>
          <span class="cal-title-label">日历</span>
        </div>
        <div class="cal-nav-right">
          <BaseButton variant="ghost" size="sm" @click="prevMonth">‹</BaseButton>
          <span class="cal-title">{{ titleText }}</span>
          <BaseButton variant="ghost" size="sm" @click="nextMonth">›</BaseButton>
          <BaseButton variant="ghost" size="sm" class="cal-today-btn" @click="goToday">今天</BaseButton>
        </div>
      </div>

      <!-- Vue Cal 42 格：自定义 cell-content slot 完全重写 cell 视觉 -->
      <div class="mymemo-cal">
        <VueCal
          v-bind="calOptions"
          :events="[]"
          :selected-date="selectedDateForVueCal"
          locale="zh-cn"
          @cell-click="onCellClick"
        >
          <template #cell-content="{ cell }">
            <div class="vc-cell-inner">
              <span
                class="vc-day-num"
                :class="{
                  'is-today': isShowingCurrentMonth && (cell.formattedDate === todayKey || cell.today),
                  'is-selected': cell.formattedDate === selectedDateKey,
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
                  :title="typeLabelByType[t] ?? t"
                ></span>
              </div>
            </div>
          </template>
        </VueCal>
      </div>

      <!-- 选中日期 → 当天事件列表 -->
      <div class="day-events" v-if="selectedDateKey">
        <div class="day-events-head">
          <span class="day-events-date">
            {{ dayjs(selectedDateKey).format('M 月 D 日') }}
            <small class="day-events-weekday">
              {{ dayjs(selectedDateKey).format('dddd') }}
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
              {{ dayEventTimeLabel(e, selectedDateKey) }}
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

  <!-- ============ 嵌入模式 Dashboard：去掉外层卡片 + 冗余"日历"标题 ============ -->
  <div v-else class="cal-embedded">
    <!-- 只有月份导航控件（宿主自己有模块标题/侧边栏标识） -->
    <div class="cal-header cal-header--embedded">
      <div class="cal-nav-right">
        <BaseButton variant="ghost" size="sm" @click="prevMonth">‹</BaseButton>
        <span class="cal-title">{{ titleText }}</span>
        <BaseButton variant="ghost" size="sm" @click="nextMonth">›</BaseButton>
        <BaseButton variant="ghost" size="sm" class="cal-today-btn" @click="goToday">今天</BaseButton>
      </div>
    </div>

    <!-- Vue Cal 42 格：与独立页完全相同 -->
    <div class="mymemo-cal">
      <VueCal
        v-bind="calOptions"
        :events="[]"
        :selected-date="selectedDateForVueCal"
        locale="zh-cn"
        @cell-click="onCellClick"
      >
        <template #cell-content="{ cell }">
          <div class="vc-cell-inner">
            <span
              class="vc-day-num"
              :class="{
                'is-today': isShowingCurrentMonth && (cell.formattedDate === todayKey || cell.today),
                'is-selected': cell.formattedDate === selectedDateKey,
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
                :title="typeLabelByType[t] ?? t"
              ></span>
            </div>
          </div>
        </template>
      </VueCal>
    </div>

    <!-- 选中日期 → 当天事件列表：与独立页完全相同 -->
    <div class="day-events" v-if="selectedDateKey">
      <div class="day-events-head">
        <span class="day-events-date">
          {{ dayjs(selectedDateKey).format('M 月 D 日') }}
          <small class="day-events-weekday">
            {{ dayjs(selectedDateKey).format('dddd') }}
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
            {{ dayEventTimeLabel(e, selectedDateKey) }}
          </span>
          <span class="day-event-title">{{ e.title }}</span>
        </div>
      </div>
      <div class="day-events-empty" v-else>
        <span class="empty-icon" aria-hidden="true">·</span>
        <span class="empty-text">今天还没有安排</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============ Calendar 嵌入 Dashboard 时的布局 ============ */
.cal-embedded {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cal-header--embedded {
  justify-content: flex-end;
  margin-bottom: 4px;
}

/* ============ 独立页尺寸 ============ */
.calendar-page {
  height: 100%;
  padding: var(--space-5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.calendar-wrap {
  width: min(100%, 620px);
}

/* —— 头部：Axolotl Dashboard 风格 —— */
.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.cal-nav-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
}
.cal-ic {
  color: var(--color-primary);
  opacity: 0.9;
  display: block;
}
.cal-title-label {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  letter-spacing: 0.01em;
}
.cal-nav-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.cal-today-btn {
  margin-left: 6px;
  font-size: 11px;
  padding: 2px 8px !important;
  color: var(--color-primary);
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
  border-radius: 999px;
}
.cal-title {
  min-width: 90px;
  text-align: center;
  font-size: 13px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  letter-spacing: 0.02em;
  user-select: none;
}

/* —— Vue Cal 皮肤覆盖：默认"日历表格式" → MYMEMO 月历 Picker 风格 —— */
.mymemo-cal {
  --vc-color: var(--color-text-primary);
  --vc-background-color: transparent;
  --vc-border: none;
  --vc-border-radius: 0;
  --vc-shadow: none;
  --vc-toolbar-color: var(--color-text-primary);
  --vc-cell-background-color: transparent;
  --vc-cell-border: none;
  --vc-cell-border-radius: 0;
  --vc-cell-head-color: var(--color-text-tertiary);
  --vc-weekdays-color: var(--color-text-tertiary);
  --vc-selected-color: var(--color-text-primary);
  --vc-selected-background-color: transparent;
  --vc-today-color: var(--color-text-primary);
  --vc-today-background-color: transparent;
}
.mymemo-cal :deep(.vuecal) {
  background: transparent;
  border: none;
  box-shadow: none;
}
.mymemo-cal :deep(.vuecal__toolbar) { display: none; }
.mymemo-cal :deep(.vuecal__weekdays) {
  padding: 0 0 8px 0;
  border-bottom: none;
}
.mymemo-cal :deep(.vuecal__weekdays-cell) {
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  font-size: 10px;
  font-weight: var(--font-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.mymemo-cal :deep(.vuecal__body) {
  gap: var(--space-2);
}
.mymemo-cal :deep(.vuecal__cell) {
  background: transparent;
  border: none;
  min-height: var(--cal-cell-h, 56px);
  position: relative;
  padding: 0;
}
.mymemo-cal :deep(.vuecal__cell-content) {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 4px 0;
}

/* —— 自定义 pill：选中渐变 / Today 暖环 / 灰色跨月字 —— */
.vc-cell-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 2px;
  gap: 3px;
}
.vc-day-num {
  position: relative;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 13px;
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  user-select: none;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.vc-day-num:hover {
  background: var(--surface-bg);
  transform: translateY(-1px);
}
.vc-day-num.is-weekday-outside {
  color: var(--color-text-tertiary);
  opacity: 0.55;
}
/* Today：暖色描边圆环 */
.vc-day-num.is-today {
  box-shadow:
    inset 0 0 0 2px var(--color-accent),
    0 0 0 4px color-mix(in srgb, var(--color-accent) 12%, transparent);
  color: var(--color-accent);
  font-weight: var(--font-bold);
}
.vc-day-num.is-today:hover {
  background: color-mix(in srgb, var(--color-accent) 6%, transparent);
}
/* 选中：渐变 pill */
.vc-day-num.is-selected {
  background: var(--gradient-primary);
  color: white;
  font-weight: var(--font-bold);
  box-shadow:
    0 2px 8px color-mix(in srgb, var(--color-primary) 30%, transparent),
    0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
  transform: translateY(-1px);
}
/* Today + 选中叠加：渐变 + 外暖光环 */
.vc-day-num.is-today.is-selected {
  box-shadow:
    0 2px 8px color-mix(in srgb, var(--color-primary) 30%, transparent),
    0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent),
    inset 0 0 0 1px color-mix(in srgb, white 30%, transparent),
    0 0 0 6px color-mix(in srgb, var(--color-accent) 14%, transparent);
}

/* 事件 indicator：pill 下方 1–3 个小圆点 */
.vc-indicators {
  display: flex;
  gap: 3px;
  align-items: center;
  justify-content: center;
  height: 8px;
}
.vc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: block;
  flex: 0 0 auto;
}
.vc-cell-inner:has(.vc-day-num.is-selected) .vc-dot {
  box-shadow: 0 0 0 1px color-mix(in srgb, white 60%, transparent);
}

/* —— 选中日期当天事件列表 —— */
.day-events {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--glass-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.day-events-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.day-events-date {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.day-events-weekday {
  margin-left: 6px;
  color: var(--color-text-tertiary);
  font-weight: var(--font-medium);
  font-size: 11px;
}
.day-events-count {
  font-size: 11px;
  font-weight: var(--font-semibold);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  padding: 2px 8px;
  border-radius: 999px;
}
.day-events-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.day-event-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  font-size: 12px;
}
.day-event-type-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
}
.day-event-time {
  color: var(--color-text-tertiary);
  font-size: 11px;
  min-width: 78px;
  font-variant-numeric: tabular-nums;
}
.day-event-title {
  color: var(--color-text-primary);
  font-weight: var(--font-medium);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.day-events-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-tertiary);
  font-size: 12px;
  padding: 8px 2px;
}
.empty-icon {
  color: var(--color-text-tertiary);
  opacity: 0.7;
  font-size: 16px;
  line-height: 1;
}

@media (max-width: 520px) {
  .vc-day-num { width: 28px; height: 28px; font-size: 12px; border-radius: 8px; }
}
</style>

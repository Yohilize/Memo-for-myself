<script setup lang="ts">
import VueCal from 'vue-cal'
import 'vue-cal/dist/vuecal.css'
import dayjs from 'dayjs'
import { computed, nextTick, onMounted, ref } from 'vue'
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

const eventStore = useEventStore()

/** 当前显示月份：MYMEMO 唯一真源；**单向绑定**。
 *  —— 不接受 VueCal 通过 @update:view-date 回写。
 *     原因：vue-cal 4.x 在内部 rebuild 42 格 / 响应 selected-date / 或渲染首帧时
 *     都可能 emit 出临时或未归一化的 Date，若我们被动接收，会出现：
 *       我们 nextTick 里刚写入目标月 → vue-cal 重建月视图时 emit 回当前月 → 我们又赋回去
 *     → viewDate / selected-date 在同一渲染批里相互撕扯 → 内部子组件收到矛盾 props →
 *     轻则选中态丢失、重则 cell 渲染异常甚至整段日历消失。
 *  唯一写入 viewDate 的入口：prevMonth / nextMonth / setSelectedDate 的跨月分支。
 */
const viewDate = ref<Date>(dayjs().startOf('month').toDate())
const viewDateKey = computed(() => dayjs(viewDate.value).format('YYYY-MM'))

/** 选中日期：唯一真实数据源；存 YYYY-MM-DD 字符串。
 *  选择字符串的原因：
 *    ① 彻底消除「两个不同 Date 对象即使同一天也 !==」导致的重复赋值 / 重复触发。
 *    ② 与 cell.formattedDate / todayKey / 事件筛选 key 格式完全一致，省掉互转。
 *    ③ 从根上杜绝 vue-cal 内部 Date 引用与我们本地 Date 引用互不相等造成的 selectedDate 抖动。
 */
const selectedDateKey = ref<string>(dayjs().format('YYYY-MM-DD'))

/** vue-cal 4.x options：
 *  - activeView: 'month'               → 42 格月视图（v4 prop 名：activeView，不是 view）
 *  - titleBar / todayButton / viewsBar / time: false → 全部头部 & 动作 MYMEMO 自管
 *  - eventsOnMonthView: false          → 不在月格内渲染大块 Event Card
 *  - editableEvents: false             → 不允许默认拖建事件
 *  - startWeekOnSunday: false          → 周一起始
 *  - clickToNavigate: false            → 禁止 VueCal 因点击跨月日期自动跳月（我们自己负责）
 *  - datePicker: false                 → 禁止双击 / 右键弹出 date picker（避免触发内部导航）
 *  - currentTimeLabel: false           → 不画「现在」线
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
  hideOutOfScopeDates: false,
} as const

const titleText = computed(() => dayjs(viewDate.value).format('YYYY 年 M 月'))

/** 事件日期→indicator 字典（数据源：Pinia eventStore） */
const indicators = computed(() =>
  mapEventsToDateIndicators(eventStore.events ?? []),
)

/** 给 vue-cal 的 :selected-date 喂一个 Date 对象；
 *  计算时按天规范化到 00:00，消除时分秒带来的「同天不同 Date 实例不等」问题。
 *  只读，不反向赋值——selectedDateKey 才是唯一真源。
 */
const selectedDateForVueCal = computed<Date>(() => {
  const dj = dayjs(selectedDateKey.value)
  return (dj.isValid() ? dj : dayjs()).startOf('day').toDate()
})

/**
 * 选中日期当天的事件列表（与 indicator 数据源解耦；
 * 筛选 + 时间提取逻辑放在 service 层，UI 只做显示排序）。
 */
const eventsForSelectedDay = computed<TimeEvent[]>(() => {
  const list = filterEventsForDay(eventStore.events ?? [], selectedDateKey.value)
  return [...list].sort((a, b) =>
    dayEventSortKey(a, selectedDateKey.value).localeCompare(
      dayEventSortKey(b, selectedDateKey.value),
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

/** 统一写入 viewDate：保证 ref.value 永远是「某月第 1 天 00:00」的 Date；
 *  同时做 equal-by-month 去重，避免不必要的 VueCal rebuild。
 */
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
  setSelectedDate(today.toDate())
  // 今天按钮 = 选中今天 + 跳到今天所在月
  setViewMonth(today)
}

/** 统一选中更新入口（唯一写入点）：
 *  1. 先把传入值规范化到 YYYY-MM-DD 字符串；
 *  2. 若仍等于当前值直接 return，彻底砍掉重复触发；
 *  3. 如果点的是跨月日期 → 先选中，再 **nextTick 之后** 单独把 viewDate 跳到目标月份。
 *     —— 为什么要 nextTick 拆分：
 *        VueCal v4 内部在「同一 tick 同时收到 selected-date + view-date 两个新 Date props」时，
 *        会先处理 view 切换 → 重建 42 格 → 再处理 selected 对比，
 *        此时如果 selected-date 的 Date 引用和 rebuild 过程中内部初始化的不一致，
 *        就会把内部 selected 清空、甚至触发子组件报错，最终表现为「点了不切换 / 卡住 / 日历整段消失」。
 *        拆分 tick 后：VueCal 先只看到 selected-date 更新 → 立即把选中样式落到当前视图 →
 *        等 DOM flush 完后我们再单独更新 view-date → 跳月并保留选中，互不干扰。
 *  4. 若同月：只更新 selected，不动 viewMonth，避免整月重建。
 */
function setSelectedDate(raw: Date | string | null | undefined) {
  const dj = raw ? dayjs(raw) : dayjs()
  if (!dj.isValid()) return
  const key = dj.format('YYYY-MM-DD')
  if (key === selectedDateKey.value) return
  selectedDateKey.value = key

  const targetMonth = dj.format('YYYY-MM')
  if (viewDateKey.value !== targetMonth) {
    // DOM 更新完再改 viewMonth；避免 VueCal 双 prop 更新冲突
    nextTick(() => {
      setViewMonth(dj)
    })
  }
}

/** vue-cal 月视图单元格点击 → 走统一入口更新选中日期。
 *  ⚠️ Vue Cal 4.10.2 的 @cell-click emit 规则（源码 dist/vue-cal.es.js 第 379 行）：
 *    - 无 split：直接 emit 裸 Date 对象（不是 {date, formattedDate} 的 cell 结构）
 *    - 有 split：emit { date: Date, split: xxx }
 */
function onCellClick(payload: unknown) {
  // Case 1: 无 split → emit 裸 Date 对象（最常见的月视图情况）
  if (payload instanceof Date) {
    setSelectedDate(payload)
    return
  }
  // Case 2: 有 split → { date, split } 结构
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    if (obj.date instanceof Date) {
      setSelectedDate(obj.date)
      return
    }
    // Case 3: 兼容 cell 对象（formattedDate 字符串）
    if (typeof obj.formattedDate === 'string') {
      setSelectedDate(obj.formattedDate as string)
    }
  }
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
    <BaseCard padding="md" class="calendar-wrap">
      <!-- 自定义头部（不使用 vue-cal 默认 toolbar，MYMEMO 风格完全自管） -->
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

      <!--
        vue-cal 负责：日期计算 / 周起始 / 跨月填充 / 选中态定位
        我们自管：视觉样式（覆盖 vuecal 默认皮肤）+ 事件 indicator（小圆点）+ 头部 + 点击
        传空 events，避免 vue-cal 默认渲染大块 Event Card。

        ⚠️ :selected-date 只接受我们的 computed（string→Date 规范化），
           同时 REMOVED @update:selected-date 与 @update:view-date 监听，
           彻底切断 "vue-cal emit → 我们赋值 → vue-cal 再感知 update → 再 emit" 的循环。
        点击唯一入口是 @cell-click，全部走 setSelectedDate。
        :view-date 保持单向绑定，任何情况下不接受 emit 回写。
      -->
      <div class="mymemo-cal">
        <VueCal
          v-bind="calOptions"
          :events="[]"
          :view-date="viewDate"
          :selected-date="selectedDateForVueCal"
          locale="zh-cn"
          @cell-click="onCellClick"
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
              <!-- 视觉主体：数字 pill（Month Picker 风格；状态都在 pill 本身而非外层 cell） -->
              <span
                class="vc-day-num"
                :class="{
                  'is-today': cell.formattedDate === todayKey || cell.today,
                  'is-selected': cell.formattedDate === selectedDateKey,
                  'is-weekday-outside': cell.outOfScope,
                }"
              >
                {{ cell.content }}
              </span>
              <!-- 事件轻量 indicator：pill 下方 1–3 个 tiny 彩色圆点；不显示任何事件文字 -->
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

      <!-- 选中日期 → 当天事件列表（Dashboard 模块：紧凑、轻量、不占太多高度） -->
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
</template>

<style scoped>
/* ============ Dashboard 模块尺寸：参考 Axolotl Dashboard 里的「日历小卡」 ============ */
.calendar-page {
  height: 100%;
  padding: var(--space-5);
  display: flex;
  align-items: flex-start;   /* 改成贴顶居中，不再强行垂直居中 —— 模块卡不要吃满全视口高度 */
  justify-content: center;
}

.calendar-wrap {
  /* Dashboard 卡片：不再追求 920px 全宽大卡，
     适配 42 格月历在 ~420–560px 宽度上舒服显示，
     上界 620px 保证在宽屏也不横向稀得像个表格。 */
  width: min(100%, 620px);
}

/* —— 头部（Axolotl Dashboard 风格：左小图标 + 日历字样；右月份 + ‹ › 按钮）—— */
.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* 压紧：原来 space-4（~16px）→ 10px */
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
  /* 月份标题从 xl 降到 sm； Dashboard 模块卡头部不应过大 */
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
  min-width: 92px;
  text-align: center;
  margin: 0 2px;
}

/* ====== 覆盖 vue-cal 默认皮肤：全部使用语义 Design Token，零硬编码色 ====== */
/* ====== 目标：Axolotl 风格「轻量 Month Picker」，不是传统大网格 Calendar ====== */
.mymemo-cal :deep(.vuecal) {
  background: transparent;
  color: var(--color-text-primary);
  font-family: inherit;
  --vuecal-primary-color: var(--color-primary);
  --vuecal-primary-color-rgb: var(--color-primary);
  --vuecal-border-color: transparent;
  --vuecal-background-color: transparent;
  --vuecal-cell-color: var(--color-text-primary);
  --vuecal-cell-disabled-color: var(--color-text-tertiary);
  --vuecal-cell-selected-background-color: transparent;
  --vuecal-cell-hover-background-color: transparent;
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

/* ---------- 周标题：Axolotl 风格 —— 单字中文、居中、小号暖色；压紧高度 ---------- */
.mymemo-cal :deep(.vuecal__weekdays-headings) {
  background: transparent;
  color: var(--color-text-tertiary);
  border: none;
  /* 压紧上下 padding，不要留白太大 */
  padding: 2px 0 6px;
  margin-bottom: 0;
}
.mymemo-cal :deep(.vuecal__weekday-heading) {
  border: none;
  background: transparent;
  color: inherit;
  padding: 2px 0;
  text-align: center;
  font-weight: var(--font-medium);
  font-size: 0; /* 隐藏默认 "星期一" 长字，交给下面的 ::before 注入单字 */
  letter-spacing: 0;
}
/* 因为 startWeekOnSunday: false → 列 1=周一 ~ 列7=周日，正好匹配 Axolotl 顺序；
   字号改小一级到 text-xs，节省高度 */
.mymemo-cal :deep(.vuecal__weekday-heading:nth-child(1))::before { content: '一'; font-size: var(--text-xs); }
.mymemo-cal :deep(.vuecal__weekday-heading:nth-child(2))::before { content: '二'; font-size: var(--text-xs); }
.mymemo-cal :deep(.vuecal__weekday-heading:nth-child(3))::before { content: '三'; font-size: var(--text-xs); }
.mymemo-cal :deep(.vuecal__weekday-heading:nth-child(4))::before { content: '四'; font-size: var(--text-xs); }
.mymemo-cal :deep(.vuecal__weekday-heading:nth-child(5))::before { content: '五'; font-size: var(--text-xs); }
.mymemo-cal :deep(.vuecal__weekday-heading:nth-child(6))::before { content: '六'; font-size: var(--text-xs); color: var(--color-text-secondary); }
.mymemo-cal :deep(.vuecal__weekday-heading:nth-child(7))::before { content: '日'; font-size: var(--text-xs); color: var(--color-text-secondary); }

/* ---------- 行/单元格：去掉 ALL 网格线 / 边框 / 大块背景；高度收紧 ---------- */
.mymemo-cal :deep(.vuecal__body) {
  border: none;
}
.mymemo-cal :deep(.vuecal__week) {
  border: none;
  /* 行距从 72 收小到 46：
     - pill 高度 32
     - 圆点 4 + 间距 2 = 6
     - 上下 cell padding 共 4
     = 42 左右；给 46 留 breathing。 */
  min-height: 46px;
}
.mymemo-cal :deep(.vuecal__cell) {
  background: transparent !important;
  border: none !important;
  /* 缩小 cell padding：从 4px 6px → 2px 3px，横向更紧密，纵向也收紧 */
  padding: 2px 3px;
  box-sizing: border-box;
  transition: none;
}
/* 去掉 vue-cal 默认 hover / selected / today 施加在 cell 级的底色和 glow */
.mymemo-cal :deep(.vuecal__cell:hover),
.mymemo-cal :deep(.vuecal__cell.vuecal__cell--selected),
.mymemo-cal :deep(.vuecal__cell.vuecal__cell--today),
.mymemo-cal :deep(.vuecal__cell.vuecal__cell--out-of-scope) {
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  outline: none !important;
}
/* vue-cal 默认会在 cell 外增加 selected 蓝色 glow；全清 */
.mymemo-cal :deep(.vuecal__cell::before),
.mymemo-cal :deep(.vuecal__cell::after) {
  display: none !important;
}

/* ---------- cell 内部：Month Picker 的数字 pill 主体；高度收紧 ---------- */
.vc-cell-inner {
  width: 100%;
  height: 100%;
  /* min-height 收小到 40，让 6 行 × 40 = 240，加 header/周头 ≈ 300px 以内 */
  min-height: 40px;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;   /* 水平居中：pill 在 cell 中间 */
  justify-content: center;
  /* pill 与圆点之间只留 2px 缝隙（Dashboard 卡内紧凑） */
  gap: 2px;
  box-sizing: border-box;
}

/* —— 数字 pill：Dashboard 模块里尺寸不宜太大（避免撑高）—— */
.vc-day-num {
  /* 点击热区 32×32（和 Axolotl Dashboard 截图视觉尺寸匹配） */
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  /* 圆角方块：Dashboard 卡内用 10px 就够软（之前 12px 是大卡版） */
  border-radius: 10px;
  /* 字号从 base 降到 sm（13–14px 档位），跟 pill 32px 更协调 */
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  font-weight: var(--font-medium);
  font-variant-numeric: tabular-nums;
  position: relative;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
  user-select: none;
}
/* Hover：只有 pill 自己给个极轻微的玻璃态底色，不影响 cell 背景 */
.vc-day-num:hover {
  background: var(--glass-bg-hover);
}
/* 跨月：淡化（但尺寸/热区不变，保证可点击） */
.vc-day-num.is-weekday-outside {
  color: var(--color-text-tertiary);
  font-weight: var(--font-regular);
}
/* 今天：一圈暖色细环 + 不填充，低调表示"今天在这里"（类似 Axolotl today 环） */
.vc-day-num.is-today {
  background: transparent;
  color: var(--color-text-primary);
  font-weight: var(--font-semibold);
  box-shadow: inset 0 0 0 1.25px var(--color-primary-light);
}
.vc-day-num.is-weekday-outside.is-today {
  color: var(--color-text-secondary);
  box-shadow: inset 0 0 0 1.25px
    color-mix(in srgb, var(--color-primary-light) 70%, transparent);
}
/* 选中：柔和但明确的渐变 fill；优先级最高，覆盖 today 样式 */
.vc-day-num.is-selected {
  background: var(--gradient-primary);
  color: var(--color-text-on-gradient);
  font-weight: var(--font-semibold);
  box-shadow:
    0 2px 6px color-mix(in srgb, var(--color-primary) 20%, transparent),
    inset 0 0 0 1px
      color-mix(in srgb, var(--color-primary) 14%, var(--color-text-on-gradient));
}
.vc-day-num.is-selected.is-weekday-outside {
  /* 跨月选中仍然是清晰的渐变 fill（用户主动选的），但颜色稍微柔一点 */
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-primary) 78%, var(--color-primary-light) 22%),
    color-mix(in srgb, var(--color-accent) 78%, var(--color-accent) 22%)
  );
  color: var(--color-text-on-gradient);
}
/* 选中 + 今天 同天：today 的环不需要了，选中渐变本身已足够突出 */
.vc-day-num.is-selected.is-today {
  box-shadow: 0 2px 8px
    color-mix(in srgb, var(--color-primary) 24%, transparent);
}

/* ---------- 事件 indicator：pill 下方、居中、tiny 圆点；高度几乎不占 ---------- */
.vc-indicators {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  /* 固定 3px 高度（即使无 indicator，也占个最小占位，避免切换日期点有/无事件行跳动） */
  height: 3px;
  padding: 0;
}
.vc-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  opacity: 0.92;
  /* 极淡的统一边，让浅色背景下圆点不被吃掉 */
  box-shadow: 0 0 0 1px
    color-mix(in srgb, currentColor 8%, transparent);
}

/* vue-cal 默认事件容器：隐藏，避免未来即使误传 events 也渲染大块卡 */
.mymemo-cal :deep(.vuecal__cell-events) {
  display: none;
}
.mymemo-cal :deep(.vuecal__cell-content) {
  padding: 0;
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
}

/* ---------- 选中日期 → 当天事件列表（Dashboard 版：紧凑、轻量） ---------- */
.day-events {
  /* 与月历间隔从 space-6（~24px）收小到 14px */
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--surface-border);
}
.day-events-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
  padding: 0 2px;
}
.day-events-date {
  /* 月份标题缩到 text-sm，不再喧宾夺主 */
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.day-events-weekday {
  margin-left: 4px;
  font-size: 11px;
  font-weight: var(--font-regular);
  color: var(--color-text-tertiary);
}
.day-events-count {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.day-events-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.day-event-row {
  display: grid;
  grid-template-columns: 10px 58px 1fr;
  align-items: center;
  gap: 8px;
  /* 行 padding 从 8/10 收小到 6/8 */
  padding: 6px 8px;
  border-radius: 8px;
  transition: background var(--duration-fast) var(--ease-out);
}
.day-event-row:hover {
  background: var(--glass-bg-hover);
}
.day-event-type-dot {
  justify-self: center;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  box-shadow: 0 0 0 1px
    color-mix(in srgb, currentColor 18%, transparent);
}
.day-event-time {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-medium);
}
.day-event-title {
  font-size: 12px;
  color: var(--color-text-primary);
  font-weight: var(--font-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-events-empty {
  /* 空状态 padding 从 space-5 收小到 10/4；视觉更轻 */
  padding: 10px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--color-text-tertiary);
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-primary) 3.5%, transparent);
}
.empty-icon {
  font-size: 16px;
  line-height: 1;
  opacity: 0.5;
}
.empty-text {
  font-size: 12px;
  font-weight: var(--font-medium);
}
</style>

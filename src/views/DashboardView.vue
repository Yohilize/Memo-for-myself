<script setup lang="ts">
/**
 * MYMEMO 正式首页 · Dashboard（src/views/DashboardView.vue）
 *
 * 视觉骨架完全镜像 Design Lab 中的「Dashboard Preview」：
 *   · 左侧固定 Sidebar（56px 品牌导航栏；MYMEMO logo + 模块 nav + 底部开发入口）
 *   · 右侧主玻璃面板：欢迎头 + 统计 chip + 今日事件 + Calendar 正式模块
 *
 * 模块接入：
 *   · Calendar：复用 @calendar/CalendarView.vue（embedded 模式，去外层卡片/冗余标题），不复制重写
 *   · 今日事件：直接接真实 Event Store（filterEventsForDay 从 IndexedDB 拉取今天的 events），不再用静态假数据
 *   · 3 张统计 chip（待办/今日完成/灵感）：当前没有 Todo / Inspiration 业务系统，保留 Preview 静态数量与视觉
 * 保留路由：
 *   · /calendar：Calendar 独立调试页
 *   · /design-lab：Design Lab 视觉调试页（Sidebar 底部有胶囊入口）
 *   · /data-test：数据链路自检页（不删除路由；Dashboard 中不再显示占位 RouterLink，保留独立页入口）
 */
import dayjs from 'dayjs'
import { computed, onMounted, ref } from 'vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseConfirmDialog from '@/components/base/BaseConfirmDialog.vue'
import EventForm from '@calendar/EventForm.vue'
import DashboardWidgetArea from '@/components/dashboard/DashboardWidgetArea.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useEventStore } from '@/stores/eventStore'
import { useToday } from '@/composables/useToday'
import {
  isTaskPending,
  isCompletedToday,
} from '@/services/eventService'
import {
  filterEventsForDay,
  dayEventSortKey,
} from '@/services/eventCalendarMapper'
import type { TimeEvent } from '@/types/event'
import type { CreateEventInput, UpdateEventInput } from '@/services/eventTypes'

const props = defineProps<{
  /**
   * 嵌入模式：
   *  - false（默认）：完整页面模式（/）—— 外层 dashboard-root + db-glass 容器。
   *  - true：嵌入宿主（如 Design Lab 预览区）—— 仅输出 sidebar + content 两个子节点，
   *          不包外层玻璃面板，交由宿主提供玻璃表面、padding 和宽度控制。
   */
  embedded?: boolean
}>()

const embedded = computed(() => !!props.embedded)
const eventStore = useEventStore()

// —— Dashboard Head：真实今天的日期 & 问候语（时间段对应） —— //
const today = dayjs()
// 跨午夜自动刷新的「今天」键：统计/今日事件基于它，天然随日期重算
const { todayKey } = useToday()
const dateText = computed(() => today.format('YYYY年M月D日 · dddd'))
const greetingText = computed(() => {
  const h = today.hour()
  if (h < 6) return '夜深了，注意休息 ✨'
  if (h < 12) return '早上好，新的一天开始啦 ☀️'
  if (h < 14) return '中午好，记得吃饭 🍚'
  if (h < 18) return '下午好，保持专注 🌿'
  if (h < 22) return '晚上好，今天辛苦了 🌙'
  return '夜深了，早点休息 🌌'
})

// —— 今日事件：直接接真实 Event Store（按类型色条 + 基础样式参考 Preview pv-event） —— //
const eventsForToday = computed<TimeEvent[]>(() => {
  const all = filterEventsForDay(eventStore.events ?? [], todayKey.value)
  return [...all].sort((a, b) =>
    dayEventSortKey(a, todayKey.value).localeCompare(dayEventSortKey(b, todayKey.value)),
  )
})

const typeColorByType: Record<string, string> = {
  calendar: 'var(--color-event-calendar)',
  deadline: 'var(--color-event-deadline)',
  duration: 'var(--color-event-duration)',
  idea: 'var(--color-event-idea)',
}
const typeLabelByType: Record<string, string> = {
  calendar: '行程',
  deadline: 'Deadline',
  duration: '时间块',
  idea: '灵感',
}

// —— Dashboard 统计块：直接接真实 Event Store（新增/编辑/删除后 Pinia 响应式自动刷新） —— //
//  · 待办：基于「事件数据 + 今天」的派生状态，仅计入未完成且非终止态的任务型事件
//         （无状态/已完成/已取消不计入；有状态的 calendar/duration 按日期自动推导）
//  · 今日完成：落在今天 且派生状态 = 已完成 的任务事件（idea 不参与）
//  · 灵感：type = idea 且未归档的事件
const statChips = computed(() => [
  {
    tag: '待办',
    // 基于派生显示状态：无状态、已完成、已取消均不计入待办；
    // 有状态的 calendar/duration 会根据日期自动推导为待办/进行中，已完成态不再列为待办
    value: eventStore.events.filter(
      (e) => e.type !== 'idea' && isTaskPending(e, todayKey.value),
    ).length,
    accent: 'var(--color-primary)',
  },
  {
    tag: '今日完成',
    value: filterEventsForDay(eventStore.events ?? [], todayKey.value).filter(
      (e) => e.type !== 'idea' && isCompletedToday(e, todayKey.value),
    ).length,
    accent: 'var(--color-success)',
  },
  {
    tag: '灵感',
    // 仅统计未归档灵感：已归档（archived === true）不计入数量
    value: eventStore.events.filter(
      (e) => e.type === 'idea' && !(e.archived ?? false),
    ).length,
    accent: 'var(--color-accent)',
  },
])

/* ==============================================================================
 *  Dashboard 级别 CRUD UI（今日事件的编辑 / 删除 + 一份 EventForm 弹窗）
 *  与 Calendar 内部的 CRUD 操作同一个 eventStore → Pinia 响应式会双向同步：
 *    - 在 Dashboard 改了今日事件 → Calendar indicator + 选中日期列表立刻刷新
 *    - 在 Calendar 改了今日事件 → Dashboard 今日事件立刻刷新
 * ============================================================================== */
const dbFormVisible = ref(false)
const dbEditingEvent = ref<TimeEvent | null>(null)
const dbDeleteTarget = ref<TimeEvent | null>(null)

function openDbEdit(e: TimeEvent) {
  dbEditingEvent.value = e
  dbFormVisible.value = true
}
function requestDbDelete(e: TimeEvent) {
  dbDeleteTarget.value = e
}
function cancelDbDelete() {
  dbDeleteTarget.value = null
}
async function confirmDbDelete() {
  const e = dbDeleteTarget.value
  if (!e) return
  dbDeleteTarget.value = null
  try {
    await eventStore.remove(e.id)
    if (dbEditingEvent.value?.id === e.id) dbEditingEvent.value = null
  } catch (_err) {
    // 忽略，eventStore.error 已持有文案
  }
}
async function handleDbSubmitCreate(input: CreateEventInput) {
  try {
    await eventStore.create(input)
    dbFormVisible.value = false
  } catch (_err) {
    /* 同上 */
  }
}
async function handleDbSubmitUpdate(id: string, patch: UpdateEventInput) {
  try {
    await eventStore.update(id, patch)
    dbFormVisible.value = false
    dbEditingEvent.value = null
  } catch (_err) {
    /* 同上 */
  }
}

onMounted(() => {
  eventStore.loadAll()
})
</script>

<template>
  <!-- embedded=true：仅输出 sidebar + content 两个 flex 子节点，交由宿主（DSL preview-app-inner）提供玻璃表面与容器宽度 -->
  <template v-if="embedded">
    <AppSidebar active-path="/" />
    <main class="db-content">
      <div class="db-head">
        <div class="db-date">{{ dateText }}</div>
        <div class="db-greet">{{ greetingText }}</div>
      </div>
      <div class="db-chips">
        <BaseCard v-for="c in statChips" :key="c.tag" padding="md" class="db-chip">
          <div class="chip-title">{{ c.tag }}</div>
          <div class="chip-val" :style="{ color: c.accent }">
            {{ c.value }}
          </div>
        </BaseCard>
      </div>
      <DashboardWidgetArea
        :events="eventsForToday"
        :all-events="eventStore.events"
        :today-key="todayKey"
        :type-color-by-type="typeColorByType"
        :type-label-by-type="typeLabelByType"
        @edit-event="openDbEdit"
        @delete-event="requestDbDelete"
      />
    </main>
  </template>

  <!-- embedded=false（默认）：完整主界面 → dashboard-root 外层留白 + db-glass 玻璃面板 -->
  <div v-else class="dashboard-root">
    <section class="db-glass" aria-label="MYMEMO Dashboard">
      <AppSidebar active-path="/" />
      <main class="db-content">
        <div class="db-head">
          <div class="db-date">{{ dateText }}</div>
          <div class="db-greet">{{ greetingText }}</div>
        </div>
        <div class="db-chips">
          <BaseCard v-for="c in statChips" :key="c.tag" padding="md" class="db-chip">
            <div class="chip-title">{{ c.tag }}</div>
            <div class="chip-val" :style="{ color: c.accent }">
              {{ c.value }}
            </div>
          </BaseCard>
        </div>
        <DashboardWidgetArea
          :events="eventsForToday"
          :all-events="eventStore.events"
          :today-key="todayKey"
          :type-color-by-type="typeColorByType"
          :type-label-by-type="typeLabelByType"
          @edit-event="openDbEdit"
          @delete-event="requestDbDelete"
        />
      </main>
    </section>
  </div>

  <!-- ===== 全局 CRUD 弹窗：无论 embedded 与否，都挂一份 fixed 级别弹窗 ===== -->
  <EventForm
    v-model:visible="dbFormVisible"
    :default-date="todayKey"
    :editing-event="dbEditingEvent"
    @submit-create="handleDbSubmitCreate"
    @submit-update="handleDbSubmitUpdate"
    @delete="(id) => { const e = eventStore.events.find(x => x.id === id); if (e) requestDbDelete(e) }"
  />
  <BaseConfirmDialog
    :visible="!!dbDeleteTarget"
    :event-title="dbDeleteTarget?.title ?? ''"
    @cancel="cancelDbDelete"
    @confirm="confirmDbDelete"
  />
</template>

<style scoped>
/* ============ 所有视觉参数全部走 tokens.css 语义化 Design Token，零硬编码色 ============ */
/*
 * 布局层级严格镜像 Design Lab 的 preview-app → preview-app-inner → preview-content：
 *   外层 .dashboard-root（对应 preview-app，36px 外层留白，flex 居中）
 *     内层 .db-glass（对应 preview-app-inner，height: 84vh，不占满整屏，居中后再 8% 上下留白）
 *       侧栏 .db-sidebar（对应 preview-sidebar）
 *       主区 .db-content（对应 preview-content，padding:20px）
 *         内容 .db-head/.db-chips/.db-widget-area（对应 pv-dashboard，gap:16px）
 */
.dashboard-root {
  position: relative;
  width: 100%;
  min-height: 100vh;
  padding: 36px;                               /* 对应 preview-app { padding: 36px } */
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* —— 主玻璃面板：严格镜像 Design Lab preview-app-inner（玻璃表面、阴影、圆角、overflow、height:84%）—— */
.db-glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  width: min(100%, var(--app-width, 960px));
  max-width: calc(100% - 0px);                      /* 外层已有 36px padding，此处直接用容器宽度 */
  min-width: 360px;
  height: min(84vh, 820px);                         /* 对应 preview-app-inner { height: 84% } → 两层叠加后约 8% 上 + 8% 下留白 */
  border-radius: var(--glass-radius);
  display: flex;
  overflow: hidden;
}

/* =================================== 右侧主内容区（镜像 preview-content padding:20px） =================================== */
.db-content {
  flex: 1;
  padding: 20px;                                   /* 对应 preview-content { padding: 20px } */
  overflow-y: auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;                                       /* 对应 pv-dashboard { gap: 16px } */
}

/* ---------- Head：日期 + 问候语（pv-date / pv-greet） ---------- */
.db-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.db-date {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.db-greet {
  font-size: 18px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  line-height: 1.4;
  background: var(--gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* ---------- 统计 chip 行（pv-row / pv-chip；一行 3 个卡片） ---------- */
.db-chips {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.db-chip {
  flex: 1;
  min-width: 100px;
}
.chip-title {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.chip-val {
  font-size: 22px;
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
  margin-top: 2px;
  line-height: 1.1;
}

/* ---------- 响应式：小屏压缩 gap / padding；DSL 逻辑对齐 ---------- */
@media (max-width: 680px) {
  .dashboard-root { padding: var(--space-4); min-height: 100vh; }
  .db-glass {
    height: 88vh;
    border-radius: calc(var(--glass-radius) - 4px);
  }
  .db-content { padding: 16px; gap: 14px; }
  .db-chips { gap: 8px; }
  .db-chip { min-width: 80px; }
  .chip-val { font-size: 18px; }
}
</style>

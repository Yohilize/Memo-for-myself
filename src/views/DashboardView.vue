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
import { RouterLink } from 'vue-router'
import dayjs from 'dayjs'
import { computed, onMounted } from 'vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import CalendarView from '@calendar/CalendarView.vue'
import { useEventStore } from '@/stores/eventStore'
import {
  filterEventsForDay,
  dayEventTimeLabel,
  dayEventSortKey,
} from '@/services/eventCalendarMapper'
import type { TimeEvent } from '@/types/event'

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
const todayKey = today.format('YYYY-MM-DD')
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
  const all = filterEventsForDay(eventStore.events ?? [], todayKey)
  return [...all].sort((a, b) =>
    dayEventSortKey(a, todayKey).localeCompare(dayEventSortKey(b, todayKey)),
  )
})

const todayCountChip = computed(() => eventsForToday.value.length)

const typeColorByType: Record<string, string> = {
  calendar: 'var(--color-event-calendar)',
  deadline: 'var(--color-event-deadline)',
  duration: 'var(--color-event-duration)',
  idea: 'var(--color-event-idea)',
}
const typeLabelByType: Record<string, string> = {
  calendar: '日历事件',
  deadline: 'Deadline',
  duration: '时间块',
  idea: '灵感',
}

// —— Dashboard 静态占位统计（Todo/Inspiration 业务系统未上线，保持 Preview 视觉） —— //
// ⚠️ 保留静态，不为了填数字新建业务 Store；未来 Todo/Inspiration 上线后再替换为 computed。
const statChips = [
  { tag: '待办', value: 5, accent: 'var(--color-primary)' },
  { tag: '今日完成', value: 2, accent: 'var(--color-success)' },
  { tag: '灵感', value: 9, accent: 'var(--color-accent)' },
] as const

onMounted(() => {
  eventStore.loadAll()
})
</script>

<template>
  <!-- embedded=true：仅输出 sidebar + content 两个 flex 子节点，交由宿主（DSL preview-app-inner）提供玻璃表面与容器宽度 -->
  <template v-if="embedded">
    <aside class="db-sidebar" aria-label="主导航">
      <img class="db-logo" src="/favicon.png" alt="MYMEMO" draggable="false" />
      <nav class="db-nav" aria-label="模块导航">
        <RouterLink to="/" class="db-nav-item active" aria-label="Calendar（当前模块）" title="Calendar">📅</RouterLink>
        <div class="db-nav-item" aria-disabled="true" title="Todo（开发中）">⏰</div>
        <div class="db-nav-item" aria-disabled="true" title="Inspiration（开发中）">💡</div>
      </nav>
      <RouterLink to="/design-lab" class="db-dsl-entry" title="Design Lab（视觉调试）">
        <svg class="db-dsl-ic" aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="13.5" cy="6.5" r=".5"/>
          <circle cx="17.5" cy="10.5" r=".5"/>
          <circle cx="8.5" cy="7.5" r=".5"/>
          <circle cx="6.5" cy="12.5" r=".5"/>
          <path d="M12 2a10 10 0 0 0-7.07 17.07A10 10 0 1 0 12 2z"/>
          <path d="M12 22C9 18 6 14 6 12c0-3 2.5-5 6-5s6 2 6 5c0 2-3 6-6 10z"/>
        </svg>
      </RouterLink>
    </aside>
    <main class="db-content">
      <div class="db-head">
        <div class="db-date">{{ dateText }}</div>
        <div class="db-greet">{{ greetingText }}</div>
      </div>
      <div class="db-chips">
        <BaseCard v-for="c in statChips" :key="c.tag" padding="md" class="db-chip">
          <div class="chip-title">{{ c.tag }}</div>
          <div class="chip-val" :style="{ color: c.accent }">
            {{ c.tag === '今日完成' ? todayCountChip : c.value }}
          </div>
        </BaseCard>
      </div>
      <div class="db-section-title">今日事件</div>
      <div class="db-events" v-if="eventsForToday.length">
        <div
          v-for="e in eventsForToday" :key="e.id" class="db-event"
          :style="{ '--c': typeColorByType[e.type] ?? 'var(--color-text-tertiary)' }"
        >
          <span class="db-event-dot"></span>
          <div class="db-event-body">
            <div class="db-event-title">{{ e.title }}</div>
            <div class="db-event-meta">
              {{ typeLabelByType[e.type] ?? e.type }} · {{ dayEventTimeLabel(e, todayKey) }}
            </div>
          </div>
          <BaseBadge :color="typeColorByType[e.type] ?? 'var(--color-text-tertiary)'">
            {{ typeLabelByType[e.type] ?? e.type }}
          </BaseBadge>
        </div>
      </div>
      <div v-else class="db-events-empty">
        <span class="db-empty-ic">·</span>
        <span>今天还没有事件，保持轻松的一天吧。</span>
      </div>
      <div class="db-section-title db-cal-title">
        <span>日历</span>
        <RouterLink to="/calendar" class="db-cal-link" title="打开 Calendar 独立调试页">独立页</RouterLink>
      </div>
      <div class="db-cal-wrap">
        <CalendarView embedded />
      </div>
    </main>
  </template>

  <!-- embedded=false（默认）：完整主界面 → dashboard-root 外层留白 + db-glass 玻璃面板 -->
  <div v-else class="dashboard-root">
    <section class="db-glass" aria-label="MYMEMO Dashboard">
      <aside class="db-sidebar" aria-label="主导航">
        <img class="db-logo" src="/favicon.png" alt="MYMEMO" draggable="false" />
        <nav class="db-nav" aria-label="模块导航">
          <RouterLink to="/" class="db-nav-item active" aria-label="Calendar（当前模块）" title="Calendar">📅</RouterLink>
          <div class="db-nav-item" aria-disabled="true" title="Todo（开发中）">⏰</div>
          <div class="db-nav-item" aria-disabled="true" title="Inspiration（开发中）">💡</div>
        </nav>
        <RouterLink to="/design-lab" class="db-dsl-entry" title="Design Lab（视觉调试）">
          <svg class="db-dsl-ic" aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="13.5" cy="6.5" r=".5"/>
            <circle cx="17.5" cy="10.5" r=".5"/>
            <circle cx="8.5" cy="7.5" r=".5"/>
            <circle cx="6.5" cy="12.5" r=".5"/>
            <path d="M12 2a10 10 0 0 0-7.07 17.07A10 10 0 1 0 12 2z"/>
            <path d="M12 22C9 18 6 14 6 12c0-3 2.5-5 6-5s6 2 6 5c0 2-3 6-6 10z"/>
          </svg>
        </RouterLink>
      </aside>
      <main class="db-content">
        <div class="db-head">
          <div class="db-date">{{ dateText }}</div>
          <div class="db-greet">{{ greetingText }}</div>
        </div>
        <div class="db-chips">
          <BaseCard v-for="c in statChips" :key="c.tag" padding="md" class="db-chip">
            <div class="chip-title">{{ c.tag }}</div>
            <div class="chip-val" :style="{ color: c.accent }">
              {{ c.tag === '今日完成' ? todayCountChip : c.value }}
            </div>
          </BaseCard>
        </div>
        <div class="db-section-title">今日事件</div>
        <div class="db-events" v-if="eventsForToday.length">
          <div
            v-for="e in eventsForToday" :key="e.id" class="db-event"
            :style="{ '--c': typeColorByType[e.type] ?? 'var(--color-text-tertiary)' }"
          >
            <span class="db-event-dot"></span>
            <div class="db-event-body">
              <div class="db-event-title">{{ e.title }}</div>
              <div class="db-event-meta">
                {{ typeLabelByType[e.type] ?? e.type }} · {{ dayEventTimeLabel(e, todayKey) }}
              </div>
            </div>
            <BaseBadge :color="typeColorByType[e.type] ?? 'var(--color-text-tertiary)'">
              {{ typeLabelByType[e.type] ?? e.type }}
            </BaseBadge>
          </div>
        </div>
        <div v-else class="db-events-empty">
          <span class="db-empty-ic">·</span>
          <span>今天还没有事件，保持轻松的一天吧。</span>
        </div>
        <div class="db-section-title db-cal-title">
          <span>日历</span>
          <RouterLink to="/calendar" class="db-cal-link" title="打开 Calendar 独立调试页">独立页</RouterLink>
        </div>
        <div class="db-cal-wrap">
          <CalendarView embedded />
        </div>
      </main>
    </section>
  </div>
</template>

<style scoped>
/* ============ 所有视觉参数全部走 tokens.css 语义化 Design Token，零硬编码色 ============ */
/*
 * 布局层级严格镜像 Design Lab 的 preview-app → preview-app-inner → preview-content：
 *   外层 .dashboard-root（对应 preview-app，36px 外层留白，flex 居中）
 *     内层 .db-glass（对应 preview-app-inner，height: 84vh，不占满整屏，居中后再 8% 上下留白）
 *       侧栏 .db-sidebar（对应 preview-sidebar）
 *       主区 .db-content（对应 preview-content，padding:20px）
 *         内容 .db-head/.db-chips/.db-events/.db-cal-wrap（对应 pv-dashboard，gap:16px）
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

/* =================================== 左侧 Sidebar（56px，镜像 preview-sidebar） =================================== */
.db-sidebar {
  width: 56px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border-right: 1px solid var(--surface-border);
  flex-shrink: 0;
  background: color-mix(in srgb, var(--color-primary) 2%, transparent);
}
.db-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  object-fit: cover;
  object-position: center center;
  display: block;
  margin-bottom: 8px;
  user-select: none;
  -webkit-user-drag: none;
  background: color-mix(in srgb, var(--color-accent) 14%, transparent);
  flex-shrink: 0;
}
.db-nav {
  display: contents;   /* 让 nav-item 直接继承 sidebar 的 flex 列布局 + gap */
}
.db-nav-item {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  opacity: 0.5;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.db-nav-item:hover {
  opacity: 0.85;
  background: var(--glass-bg-hover);
  transform: translateY(-1px);
}
.db-nav-item.active {
  opacity: 1;
  background: var(--surface-bg);
  cursor: default;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 14%, transparent),
    0 2px 6px color-mix(in srgb, var(--color-primary) 10%, transparent);
}
.db-nav-item[aria-disabled="true"] {
  cursor: not-allowed;
}
/* 底部 Design Lab 入口小胶囊：固定到 sidebar 底部 */
.db-dsl-entry {
  margin-top: auto;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
  color: var(--color-primary);
  text-decoration: none;
  transition:
    background var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.db-dsl-entry:hover {
  background: var(--glass-bg-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 16%, transparent);
}
.db-dsl-ic {
  flex: 0 0 auto;
  display: block;
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

/* ---------- section title（严格镜像 pv-section-title：margin-top/bottom 8px，不用负值） ---------- */
.db-section-title {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--color-text-tertiary);
  font-weight: var(--font-semibold);
  margin-top: 8px;                                /* 对应 pv-section-title { margin-top: 8px; margin-bottom: 8px } */
  margin-bottom: 8px;
}
.db-cal-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.db-cal-link {
  font-size: 10px;
  letter-spacing: 0.03em;
  color: var(--color-primary);
  text-decoration: none;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
  opacity: 0.85;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);
}
.db-cal-link:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

/* ---------- 今日事件列表（pv-events）：真实 Event Store 数据 ---------- */
.db-events {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.db-event {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  border-left: 3px solid var(--c);
}
.db-event-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c);
  margin-top: 3px;
  flex-shrink: 0;
}
.db-event-body {
  flex: 1;
  min-width: 0;
}
.db-event-title {
  font-size: 13px;
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}
.db-event-meta {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 2px;
}
.db-events-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px;
  background: color-mix(in srgb, var(--surface-bg) 60%, transparent);
  border: 1px dashed var(--glass-border);
  border-radius: 12px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.db-empty-ic {
  color: var(--color-text-tertiary);
  opacity: 0.7;
  font-size: 16px;
  line-height: 1;
}

/* ---------- Calendar 正式模块容器（宽度占满 content；CalendarView embedded 模式自身宽 100%） ---------- */
.db-cal-wrap {
  width: min(100%, 620px);
  align-self: flex-start;   /* 不要拉伸 Calendar 到整个面板宽度，保持合适月历尺寸；左对齐 */
}

/* ---------- 响应式：小屏压缩 gap / padding；DSL 逻辑对齐 ---------- */
@media (max-width: 680px) {
  .dashboard-root { padding: var(--space-4); min-height: 100vh; }
  .db-glass {
    height: 88vh;
    border-radius: calc(var(--glass-radius) - 4px);
  }
  .db-content { padding: 16px; gap: 14px; }
  .db-cal-wrap { width: 100%; }
  .db-chips { gap: 8px; }
  .db-chip { min-width: 80px; }
  .chip-val { font-size: 18px; }
}
</style>

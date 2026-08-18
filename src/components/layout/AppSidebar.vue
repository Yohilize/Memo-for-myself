<script setup lang="ts">
/**
 * AppSidebar — MYMEMO 全局左侧品牌导航栏（56px）。
 *
 * 完全复用 DashboardView 中的 db-sidebar 结构与样式，抽成独立组件便于：
 *   · Dashboard（/）· Events（/events）· Ideas（/ideas） 三个页面共用同一套导航
 *
 * 导航定义（本次迭代）：
 *   · 📅 仪表盘 /      →  Dashboard（日历作为核心组件嵌入其中，不是独立页面）
 *   · 📋 事件   /events →  事件全览总页面（后续开发，本次预留占位入口）
 *   · 💡 灵感   /ideas  →  独立灵感页面（本次重点开发）
 *
 * 图标全部使用 Emoji，等后续有素材再替换。
 */
import { RouterLink, useRoute } from 'vue-router'
import { computed } from 'vue'

interface Props {
  /**
   * 当前激活路由名（可选）。
   * - 不传：内部自动 useRoute() 读取 $route.path，方便多数页面使用。
   * - 传入：由父组件显式指定（如 embedded 模式下没有路由上下文的场景）。
   */
  activePath?: '/' | '/events' | '/ideas'
}

const props = defineProps<Props>()

const route = useRoute()
const currentPath = computed(() => props.activePath ?? route.path)

function isActive(path: string) {
  if (path === '/') return currentPath.value === '/'
  return currentPath.value.startsWith(path)
}
</script>

<template>
  <aside class="db-sidebar" aria-label="主导航">
    <img class="db-logo" src="/favicon.png" alt="MYMEMO" draggable="false" />
    <nav class="db-nav" aria-label="模块导航">
      <RouterLink
        to="/"
        class="db-nav-item"
        :class="{ active: isActive('/') }"
        aria-label="仪表盘"
        title="仪表盘"
      >📅</RouterLink>
      <RouterLink
        to="/events"
        class="db-nav-item"
        :class="{ active: isActive('/events') }"
        aria-label="事件全览（开发中）"
        title="事件全览"
      >📋</RouterLink>
      <RouterLink
        to="/ideas"
        class="db-nav-item"
        :class="{ active: isActive('/ideas') }"
        aria-label="灵感"
        title="灵感"
      >💡</RouterLink>
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
</template>

<style scoped>
/* =================================== 左侧 Sidebar（56px，镜像 Dashboard 中 db-sidebar） =================================== */
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
  text-decoration: none;
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
</style>

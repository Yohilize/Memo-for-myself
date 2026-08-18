<script setup lang="ts">
/**
 * EventsPlaceholderView — 事件全览占位页（/events）。
 * 本次只预留入口，不做具体功能，后续开发。
 * 保持与 Dashboard / Ideas 相同的整体布局结构，确保视觉一致性。
 */
import AppSidebar from '@/components/layout/AppSidebar.vue'
import BaseCard from '@/components/base/BaseCard.vue'
</script>

<template>
  <div class="events-root">
    <section class="events-glass" aria-label="事件全览">
      <AppSidebar active-path="/events" />
      <main class="events-content">
        <header class="events-head">
          <div class="events-title">📋 事件全览</div>
          <div class="events-sub">所有事件的时间顺序总览</div>
        </header>

        <div class="events-placeholder">
          <BaseCard padding="lg" class="events-ph-card">
            <div class="events-ph-ic" aria-hidden="true">🚧</div>
            <div class="events-ph-title">功能开发中</div>
            <div class="events-ph-sub">
              这里将展示所有事件（日历、Deadline、时间块、灵感）的时间顺序总览。<br />
              敬请期待后续更新 ✨
            </div>
          </BaseCard>
        </div>
      </main>
    </section>
  </div>
</template>

<style scoped>
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

.events-head {
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

.events-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.events-ph-card {
  width: min(100%, 420px);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.events-ph-ic {
  font-size: 36px;
  opacity: 0.85;
  margin-bottom: 4px;
}
.events-ph-title {
  font-size: 15px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.events-ph-sub {
  font-size: 12px;
  color: var(--color-text-tertiary);
  line-height: 1.7;
}

@media (max-width: 680px) {
  .events-root { padding: var(--space-4); min-height: 100vh; }
  .events-glass {
    height: 88vh;
    border-radius: calc(var(--glass-radius) - 4px);
  }
  .events-content { padding: 16px; gap: 14px; }
}
</style>

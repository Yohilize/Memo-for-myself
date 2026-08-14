<script setup lang="ts">
/**
 * MYMEMO 主程序 · Dashboard（src/views/DashboardView.vue）
 *
 * —— 这是真正的 MYMEMO 主程序入口，而不是 design-lab 的视觉 Preview。
 * 设计定位：
 *   · 真实承载 MYMEMO 未来的业务入口（Memo、时间管理、个人 OS 式数字空间）。
 *   · 视觉骨架结构与 design-lab/Dashboard Preview 一致，以保证 DSL 对 tokens.css / 背景 / 玻璃面板
 *     的调试结果能无缝映射到真实主程序。
 *   · 但不耦合 DSL 的任何业务状态：真实数据流（Pinia→Service→Repository→IndexedDB）会走这张页面。
 *
 * 目前阶段：主骨架 + 顶栏（MYMEMO 品牌 + 右上角 Design Lab 小入口胶囊）+ 预留内容网格。
 * 未来 Calendar / Memo 等模块正式「集成」时，再把对应组件嵌入到下方内容网格。
 */
import { RouterLink } from 'vue-router'
import BaseCard from '@/components/base/BaseCard.vue'
</script>

<template>
  <div class="dashboard-root">
    <!-- 顶部栏：MYMEMO 真正主程序标识 + 右上角开发入口（小胶囊：跳 Design Lab） -->
    <header class="db-topbar">
      <div class="db-brand">
        <div class="db-logo" aria-hidden="true">M</div>
        <div class="db-brand-text">
          <div class="db-title">MYMEMO</div>
          <div class="db-subtitle">个人数字空间 · 时间管理工作台</div>
        </div>
      </div>

      <nav class="db-actions" aria-label="开发入口">
        <RouterLink to="/design-lab" class="dev-entry" title="Design Lab（独立视觉调试工具）">
          <svg class="dev-ic" aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="13.5" cy="6.5" r=".5"/>
            <circle cx="17.5" cy="10.5" r=".5"/>
            <circle cx="8.5" cy="7.5" r=".5"/>
            <circle cx="6.5" cy="12.5" r=".5"/>
            <path d="M12 2a10 10 0 0 0-7.07 17.07A10 10 0 1 0 12 2z"/>
            <path d="M12 22C9 18 6 14 6 12c0-3 2.5-5 6-5s6 2 6 5c0 2-3 6-6 10z"/>
          </svg>
          <span>Design Lab</span>
        </RouterLink>
      </nav>
    </header>

    <!-- Dashboard 主区：暂时只渲染一张 MYMEMO 欢迎卡 + 模块占位。
         正式 Calendar / Memo 集成阶段再填充真实业务模块卡。 -->
    <main class="db-grid">
      <section class="db-col-main">
        <BaseCard padding="lg" class="db-welcome-card">
          <div class="db-card-head">
            <div>
              <div class="db-card-title">MYMEMO · Dashboard</div>
              <div class="db-card-sub">
                这里是真正的 MYMEMO 主程序。
                当前阶段：视觉系统与底层数据已就绪，
                Calendar / Memo / 其他功能模块将在集成阶段陆续嵌入此处。
              </div>
            </div>
          </div>

          <div class="db-module-grid">
            <RouterLink to="/calendar" class="db-module-slot db-module-slot--soft">
              <div class="db-module-tag">Calendar</div>
              <div class="db-module-title">日历独立开发单元</div>
              <div class="db-module-desc">
                当前在 /calendar 独立调试。
                集成阶段再把正式模块嵌入此处。
              </div>
            </RouterLink>

            <RouterLink to="/data-test" class="db-module-slot">
              <div class="db-module-tag">Dev</div>
              <div class="db-module-title">数据持久化验证</div>
              <div class="db-module-desc">
                Pinia / Service / Repository / IndexedDB 数据链路自检入口。
              </div>
            </RouterLink>
          </div>
        </BaseCard>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* —— 所有视觉参数全部走 tokens.css 语义化 Design Token，零硬编码色 —— */
.dashboard-root {
  position: relative;
  width: 100%;
  min-height: 100%;
  padding: var(--space-5) var(--space-6);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-5);
}

/* 顶部栏 */
.db-topbar {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}
.db-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.db-logo {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--gradient-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-bold);
  font-size: 18px;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 24%, transparent);
}
.db-title {
  font-size: var(--text-base);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
  letter-spacing: 0.02em;
  line-height: 1.1;
}
.db-subtitle {
  margin-top: 2px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  letter-spacing: 0.01em;
}

/* 右上角开发入口胶囊：保持和 DSL Preview 同款，作为「开发阶段」的视觉通道 */
.dev-entry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
  background: color-mix(in srgb, var(--color-primary) 5%, var(--glass-bg));
  backdrop-filter: blur(var(--glass-blur));
  color: var(--color-primary);
  font-size: 11px;
  font-weight: var(--font-semibold);
  text-decoration: none;
  letter-spacing: 0.03em;
  transition:
    background var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.dev-entry:hover {
  background: var(--glass-bg-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 16%, transparent);
}
.dev-ic { flex: 0 0 auto; display: block; }

/* 主网格：当前单列居中，后续集成时改成双列 grid-template-columns 即可 */
.db-grid {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
  justify-items: center;
}
.db-col-main {
  width: 100%;
  max-width: var(--app-width);
  min-width: 0;
}

/* 欢迎卡 */
.db-welcome-card {
  width: 100%;
}
.db-card-head {
  margin-bottom: var(--space-5);
}
.db-card-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  background: var(--gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 0.02em;
  line-height: 1.2;
}
.db-card-sub {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.7;
  max-width: 56ch;
}

/* 模块占位网格：两个 1:1 slot（等视觉集成时再换成真实模块） */
.db-module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
.db-module-slot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--space-4);
  border-radius: var(--surface-radius);
  border: 1px solid var(--glass-border);
  background: var(--surface-bg);
  color: inherit;
  text-decoration: none;
  transition:
    transform var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.db-module-slot:hover {
  transform: translateY(-2px);
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  box-shadow: var(--glass-shadow);
}
.db-module-slot--soft {
  border-color: color-mix(in srgb, var(--color-accent) 28%, transparent);
}
.db-module-tag {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
  font-size: 10px;
  font-weight: var(--font-semibold);
  letter-spacing: 0.06em;
}
.db-module-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.db-module-desc {
  font-size: 12px;
  line-height: 1.7;
  color: var(--color-text-secondary);
}

@media (max-width: 680px) {
  .db-module-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

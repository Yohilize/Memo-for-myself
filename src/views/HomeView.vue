<script setup lang="ts">
import { RouterLink } from 'vue-router'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseButton from '@/components/base/BaseButton.vue'
</script>

<template>
  <div class="home">
    <BaseCard padding="lg" class="home-card">
      <div class="logo">M</div>
      <h1 class="title">MYMEMO</h1>
      <p class="subtitle">个人数字空间 · 时间管理工作台</p>

      <div class="status-list">
        <div class="status-item">
          <span class="check done">✓</span>
          <span>Phase 0 — 项目初始化 + Design Lab + Token 体系</span>
        </div>
        <div class="status-item pending">
          <span class="check">○</span>
          <span>Phase 1 — 数据层 + CRUD</span>
        </div>
        <div class="status-item pending">
          <span class="check">○</span>
          <span>Phase 2 — 模块 UI + 日历集成 + 部署</span>
        </div>
      </div>

      <RouterLink to="/playground">
        <BaseButton variant="primary" size="lg">
          进入 Design Lab →
        </BaseButton>
      </RouterLink>
    </BaseCard>
  </div>
</template>

<style scoped>
.home {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}

.home-card {
  text-align: center;
  max-width: 480px;
  width: 100%;
}

.logo {
  width: 72px;
  height: 72px;
  margin: 0 auto var(--space-4);
  border-radius: 20px;
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: var(--font-bold);
  color: white;
  box-shadow: 0 8px 24px rgba(168, 85, 247, 0.35);
}

.title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  background: var(--gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: var(--space-2);
}

.subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-6);
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  text-align: left;
  margin-bottom: var(--space-6);
}

.status-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--surface-bg);
  border-radius: var(--surface-radius);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.status-item.pending {
  opacity: 0.5;
}

.check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  flex-shrink: 0;
}

.check.done {
  background: var(--color-success);
  color: white;
}

.check:not(.done) {
  border: 1.5px solid var(--color-text-tertiary);
  color: var(--color-text-tertiary);
}
</style>

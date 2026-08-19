<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useEventStore } from '@/stores/eventStore'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import type { EventType } from '@/types/event'

const store = useEventStore()

const title = ref('')
const selectedType = ref<EventType>('calendar')
const statusMessage = ref('')

onMounted(() => {
  store.loadAll()
})

async function createEvent() {
  if (!title.value.trim()) {
    statusMessage.value = '请输入标题'
    return
  }

  const now = new Date()
  const iso = now.toISOString()
  const dateStr = now.toISOString().slice(0, 10)

  try {
    switch (selectedType.value) {
      case 'calendar':
        await store.create({
          type: 'calendar',
          title: title.value,
          event_date: dateStr,
          all_day: false,
          event_time: '09:00',
        })
        break
      case 'deadline':
        await store.create({
          type: 'deadline',
          title: title.value,
          due_date: iso,
          priority: 'medium',
        })
        break
      case 'duration':
        await store.create({
          type: 'duration',
          title: title.value,
          start_time: iso,
          end_time: new Date(now.getTime() + 3600000).toISOString(),
        })
        break
      case 'idea':
        await store.create({
          type: 'idea',
          title: title.value,
          content: '这是一条测试灵感内容',
        })
        break
    }
    title.value = ''
    statusMessage.value = `已创建 · 刷新浏览器验证数据是否保留`
  } catch (e) {
    statusMessage.value = e instanceof Error ? e.message : '创建失败'
  }
}

async function deleteEvent(id: string) {
  await store.remove(id)
}

const typeLabels: Record<EventType, string> = {
  calendar: '行程',
  deadline: 'Deadline',
  duration: '时间块',
  idea: '灵感',
}

const typeColors: Record<EventType, string> = {
  calendar: 'var(--color-event-calendar)',
  deadline: 'var(--color-event-deadline)',
  duration: 'var(--color-event-duration)',
  idea: 'var(--color-event-idea)',
}
</script>

<template>
  <div class="data-test">
    <BaseCard padding="lg" class="test-card">
      <h1 class="page-title">Phase 1 持久化验证</h1>
      <p class="page-desc">
        创建事件 → 刷新浏览器 → 数据仍存在，即 IndexedDB 持久化验证通过。
      </p>

      <div class="create-form">
        <select v-model="selectedType" class="type-select">
          <option value="calendar">行程</option>
          <option value="deadline">Deadline</option>
          <option value="duration">时间块</option>
          <option value="idea">灵感</option>
        </select>
        <input
          v-model="title"
          class="title-input"
          placeholder="输入事件标题..."
          @keyup.enter="createEvent"
        />
        <BaseButton variant="primary" @click="createEvent">创建</BaseButton>
      </div>

      <p v-if="statusMessage" class="status-msg">{{ statusMessage }}</p>
      <p v-if="store.error" class="error-msg">{{ store.error }}</p>

      <div class="stats-row">
        <span>共 {{ store.events.length }} 条事件</span>
        <span v-if="store.loading">加载中...</span>
      </div>

      <div class="event-list">
        <div v-for="event in store.events" :key="event.id" class="event-item">
          <BaseBadge :color="typeColors[event.type]">
            {{ typeLabels[event.type] }}
          </BaseBadge>
          <div class="event-info">
            <div class="event-title">{{ event.title }}</div>
            <div class="event-meta">
              {{ event.id.slice(0, 8) }} ·
              {{ new Date(event.created_at).toLocaleString('zh-CN') }}
            </div>
          </div>
          <BaseButton variant="ghost" size="sm" @click="deleteEvent(event.id)">
            删除
          </BaseButton>
        </div>
        <div v-if="store.events.length === 0 && !store.loading" class="empty-state">
          暂无数据，创建一条事件试试
        </div>
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.data-test {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}

.test-card {
  max-width: 640px;
  width: 100%;
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  background: var(--gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: var(--space-2);
}

.page-desc {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-5);
}

.create-form {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.type-select {
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 8px 12px;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  outline: none;
}

.type-select:focus {
  border-color: var(--glass-border-hover);
}

.title-input {
  flex: 1;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 8px 14px;
  color: var(--color-text-primary);
  font-size: var(--text-sm);
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.title-input:focus {
  border-color: var(--glass-border-hover);
}

.title-input::placeholder {
  color: var(--color-text-tertiary);
}

.status-msg {
  font-size: var(--text-sm);
  color: var(--color-success-light);
  margin-bottom: var(--space-2);
}

.error-msg {
  font-size: var(--text-sm);
  color: var(--color-danger-light);
  margin-bottom: var(--space-2);
}

.stats-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-3);
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.event-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
}

.event-info {
  flex: 1;
  min-width: 0;
}

.event-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.event-meta {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.empty-state {
  text-align: center;
  padding: var(--space-8);
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
}
</style>

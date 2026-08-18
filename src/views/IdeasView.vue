<script setup lang="ts">
/**
 * IdeasView — 灵感页面（/ideas）。
 *
 * 数据链路：完全复用现有 Pinia → Service → Repository → IndexedDB 链路
 *   · 数据模型：直接使用 IdeaEvent（type:'idea'，带 content / archived 字段）
 *   · Store：useEventStore（eventsByType.idea 直接拿到所有灵感）
 *   · CRUD：复用 @calendar/EventForm（已完整支持 Idea 类型：标题、内容、标签、状态、归档）
 *
 * 本次范围：
 *   · 展示所有灵感，默认按 created_at 倒序
 *   · 支持切换「显示已归档」
 *   · 支持新增、编辑、删除、归档/取消归档
 *   · 空状态（无灵感时的简洁提示）
 *   · 视觉与 Dashboard 保持一致（同套玻璃面板 + AppSidebar + Design Token）
 */
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseConfirmDialog from '@/components/base/BaseConfirmDialog.vue'
import EventForm from '@calendar/EventForm.vue'
import { useEventStore } from '@/stores/eventStore'
import type { IdeaEvent } from '@/types/event'
import type { CreateEventInput, UpdateEventInput } from '@/services/eventTypes'

const eventStore = useEventStore()

// —— 筛选/视图控制 —— //
const showArchived = ref(false)

// —— 灵感列表：仅 type='idea'，按创建时间倒序；是否包含已归档由 showArchived 控制 —— //
const ideas = computed<IdeaEvent[]>(() => {
  const all = eventStore.eventsByType.idea as IdeaEvent[]
  const filtered = showArchived.value ? all : all.filter((i) => !i.archived)
  return [...filtered].sort((a, b) => b.created_at.localeCompare(a.created_at))
})

// 统计信息
const ideaStats = computed(() => ({
  total: (eventStore.eventsByType.idea as IdeaEvent[]).length,
  active: (eventStore.eventsByType.idea as IdeaEvent[]).filter((i) => !i.archived).length,
  archived: (eventStore.eventsByType.idea as IdeaEvent[]).filter((i) => i.archived).length,
}))

/* ==============================================================================
 *  CRUD UI：新增 / 编辑 / 删除 / 归档  （复用 EventForm 弹窗 + BaseConfirmDialog）
 * ============================================================================== */
const formVisible = ref(false)
const editingEvent = ref<IdeaEvent | null>(null)
const deleteTarget = ref<IdeaEvent | null>(null)

function openNew() {
  editingEvent.value = null
  formVisible.value = true
}
function openEdit(e: IdeaEvent) {
  editingEvent.value = e
  formVisible.value = true
}
function requestDelete(e: IdeaEvent) {
  deleteTarget.value = e
}
function cancelDelete() {
  deleteTarget.value = null
}
async function confirmDelete() {
  const e = deleteTarget.value
  if (!e) return
  deleteTarget.value = null
  try {
    await eventStore.remove(e.id)
    if (editingEvent.value?.id === e.id) editingEvent.value = null
  } catch (_err) {
    /* eventStore.error 已持有 */
  }
}
async function toggleArchive(e: IdeaEvent) {
  try {
    await eventStore.update(e.id, { archived: !e.archived } as UpdateEventInput)
  } catch (_err) {
    /* eventStore.error 已持有 */
  }
}

async function handleSubmitCreate(input: CreateEventInput) {
  try {
    // 确保类型是 idea
    if (input.type !== 'idea') return
    await eventStore.create(input)
    formVisible.value = false
  } catch (_err) {
    /* eventStore.error 已持有 */
  }
}
async function handleSubmitUpdate(id: string, patch: UpdateEventInput) {
  try {
    await eventStore.update(id, patch)
    formVisible.value = false
    editingEvent.value = null
  } catch (_err) {
    /* eventStore.error 已持有 */
  }
}

// 格式化工具
function formatCreatedAt(iso: string) {
  const d = dayjs(iso)
  const now = dayjs()
  if (d.isSame(now, 'day')) return `今天 ${d.format('HH:mm')}`
  if (d.isSame(now.subtract(1, 'day'), 'day')) return `昨天 ${d.format('HH:mm')}`
  if (d.isSame(now, 'year')) return d.format('M月D日 HH:mm')
  return d.format('YYYY年M月D日')
}

const statusLabel: Record<string, string> = {
  pending: '待办',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
}

onMounted(() => {
  eventStore.loadAll()
})
</script>

<template>
  <div class="ideas-root">
    <section class="ideas-glass" aria-label="灵感">
      <AppSidebar active-path="/ideas" />
      <main class="ideas-content">
        <!-- ===== 页面头：标题 + 统计 + 操作 ===== -->
        <header class="ideas-head">
          <div class="ideas-head-left">
            <div class="ideas-title">💡 灵感</div>
            <div class="ideas-sub">
              共 <strong>{{ ideaStats.total }}</strong> 条，
              进行中 <strong>{{ ideaStats.active }}</strong> · 已归档 <strong>{{ ideaStats.archived }}</strong>
            </div>
          </div>
          <div class="ideas-head-right">
            <label class="ideas-arch-toggle">
              <input v-model="showArchived" type="checkbox" />
              <span>显示已归档</span>
            </label>
            <BaseButton variant="primary" size="sm" @click="openNew">
              + 新增灵感
            </BaseButton>
          </div>
        </header>

        <!-- ===== 空状态 ===== -->
        <div v-if="ideas.length === 0" class="ideas-empty">
          <div class="ideas-empty-ic" aria-hidden="true">✨</div>
          <div class="ideas-empty-title">
            {{ showArchived ? '还没有任何灵感记录' : '暂无进行中的灵感' }}
          </div>
          <div class="ideas-empty-sub">
            {{ showArchived ? '点击右上角「新增灵感」，写下第一个想法吧。' : '已归档的灵感会隐藏在这里，开启「显示已归档」可以查看。' }}
          </div>
          <BaseButton v-if="!showArchived" variant="ghost" size="sm" class="ideas-empty-btn" @click="showArchived = true">
            查看已归档
          </BaseButton>
        </div>

        <!-- ===== 灵感列表（卡片流） ===== -->
        <div v-else class="ideas-list">
          <BaseCard
            v-for="idea in ideas"
            :key="idea.id"
            hover
            padding="md"
            class="idea-card"
            :class="{ archived: idea.archived }"
          >
            <!-- 卡片头：标题 + 状态 + 操作 -->
            <div class="idea-card-head">
              <div class="idea-title-row">
                <h3 class="idea-title">{{ idea.title }}</h3>
                <BaseBadge
                  v-if="idea.archived"
                  color="var(--color-text-tertiary)"
                  variant="soft"
                >已归档</BaseBadge>
                <BaseBadge
                  v-else-if="idea.status"
                  :color="
                    idea.status === 'completed'
                      ? 'var(--color-success)'
                      : idea.status === 'cancelled'
                        ? 'var(--color-text-tertiary)'
                        : 'var(--color-primary)'
                  "
                  variant="soft"
                >{{ statusLabel[idea.status] }}</BaseBadge>
              </div>
              <div class="idea-actions" @click.stop>
                <button
                  class="idea-act-btn"
                  :title="idea.archived ? '取消归档' : '归档'"
                  @click="toggleArchive(idea)"
                >
                  <span aria-hidden="true">{{ idea.archived ? '📤' : '📥' }}</span>
                </button>
                <button
                  class="idea-act-btn"
                  title="编辑"
                  @click="openEdit(idea)"
                >✏️</button>
                <button
                  class="idea-act-btn danger"
                  title="删除"
                  @click="requestDelete(idea)"
                >🗑️</button>
              </div>
            </div>

            <!-- 内容 -->
            <p v-if="idea.content" class="idea-content">{{ idea.content }}</p>
            <p v-else-if="idea.notes" class="idea-content muted">{{ idea.notes }}</p>

            <!-- 标签 -->
            <div v-if="idea.tags && idea.tags.length" class="idea-tags">
              <span
                v-for="tag in idea.tags"
                :key="tag"
                class="idea-tag"
              >#{{ tag }}</span>
            </div>

            <!-- 底部时间 -->
            <div class="idea-foot">
              <span class="idea-created">🕒 {{ formatCreatedAt(idea.created_at) }}</span>
            </div>
          </BaseCard>
        </div>
      </main>
    </section>
  </div>

  <!-- ===== CRUD 弹窗 ===== -->
  <EventForm
    v-model:visible="formVisible"
    default-type="idea"
    :editing-event="editingEvent"
    @submit-create="handleSubmitCreate"
    @submit-update="handleSubmitUpdate"
    @delete="(id) => {
      const e = eventStore.events.find((x) => x.id === id) as IdeaEvent | undefined
      if (e) requestDelete(e)
    }"
  />
  <BaseConfirmDialog
    :visible="!!deleteTarget"
    :event-title="deleteTarget?.title ?? ''"
    @cancel="cancelDelete"
    @confirm="confirmDelete"
  />
</template>

<style scoped>
/* ===== 外层容器：完全镜像 DashboardView 的 dashboard-root + db-glass 结构 ===== */
.ideas-root {
  position: relative;
  width: 100%;
  min-height: 100vh;
  padding: 36px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ideas-glass {
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
.ideas-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ===== 页面头 ===== */
.ideas-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.ideas-head-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ideas-title {
  font-size: 18px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  line-height: 1.4;
  background: var(--gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.ideas-sub {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.ideas-sub strong {
  color: var(--color-text-secondary);
  font-weight: var(--font-semibold);
  margin: 0 2px;
}
.ideas-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.ideas-arch-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}
.ideas-arch-toggle input[type='checkbox'] {
  accent-color: var(--color-primary);
}

/* ===== 空状态 ===== */
.ideas-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  padding: 40px 20px;
}
.ideas-empty-ic {
  font-size: 36px;
  opacity: 0.85;
  margin-bottom: 8px;
}
.ideas-empty-title {
  font-size: 14px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.ideas-empty-sub {
  font-size: 11px;
  color: var(--color-text-tertiary);
  max-width: 300px;
  line-height: 1.6;
}
.ideas-empty-btn {
  margin-top: 8px;
}

/* ===== 灵感卡片列表 ===== */
.ideas-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.idea-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all var(--duration-fast) var(--ease-out);
}
.idea-card.archived {
  opacity: 0.72;
  background: color-mix(in srgb, var(--color-accent-2) 10%, var(--glass-bg));
}
.idea-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.idea-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.idea-title {
  margin: 0;
  font-size: 14px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
}
.idea-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.idea-act-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.idea-act-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text-primary);
  transform: translateY(-1px);
}
.idea-act-btn.danger:hover {
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
  color: var(--color-danger-light);
}

.idea-content {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}
.idea-content.muted {
  color: var(--color-text-tertiary);
  font-style: italic;
}

.idea-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.idea-tag {
  display: inline-block;
  padding: 2px 9px;
  font-size: 10px;
  border-radius: 999px;
  background: var(--color-accent-2-soft);
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
}

.idea-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 2px;
  border-top: 1px dashed var(--divider-color);
}
.idea-created {
  font-size: 10px;
  color: var(--color-text-tertiary);
}

/* ===== 响应式 ===== */
@media (max-width: 680px) {
  .ideas-root { padding: var(--space-4); min-height: 100vh; }
  .ideas-glass {
    height: 88vh;
    border-radius: calc(var(--glass-radius) - 4px);
  }
  .ideas-content { padding: 16px; gap: 14px; }
}
</style>

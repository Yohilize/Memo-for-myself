<script setup lang="ts">
/**
 * EventForm — 新增 / 编辑事件的轻量玻璃风格弹窗表单。
 *
 * 设计原则：
 *  - 完全复用 tokens.css Design Token，不硬编码颜色
 *  - 类型切换：calendar / deadline / duration / idea，不同类型动态显示对应字段
 *  - 新增模式：defaultDate（Calendar 选中日期）驱动默认值
 *  - 编辑模式：传入 editingEvent，字段回填且 type 不可更改
 */
import { computed, reactive, watch } from 'vue'
import dayjs from 'dayjs'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import type { TimeEvent, EventType, Priority, EventStatus } from '@/types/event'
import type { CreateEventInput, UpdateEventInput } from '@/services/eventTypes'

interface Props {
  visible: boolean
  defaultDate?: string // 'YYYY-MM-DD'，新增时的默认日期锚点
  editingEvent?: TimeEvent | null
}

const props = withDefaults(defineProps<Props>(), {
  defaultDate: () => dayjs().format('YYYY-MM-DD'),
  editingEvent: null,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  /** 提交新建：payload = CreateEventInput */
  submitCreate: [payload: CreateEventInput]
  /** 提交编辑：[id, patch] */
  submitUpdate: [id: string, patch: UpdateEventInput]
  /** 删除事件：id = 要删除的事件 ID */
  delete: [id: string]
  cancel: []
}>()

const isEdit = computed(() => !!props.editingEvent)
const event = props.editingEvent!

// —— 受控表单字段（全部可选，提交时按 CreateEventInput 收敛校验）—— //
type TypeSelectable = EventType
const form = reactive({
  type: 'calendar' as TypeSelectable,
  title: '',
  notes: '',
  // calendar
  event_date: '',
  all_day: false,
  event_time: '09:00',
  duration_min: null as number | null,
  // deadline
  due_date: '',
  due_time: '',
  priority: 'medium' as Priority,
  // duration
  duration_date: '',
  start_hm: '09:00',
  end_hm: '10:00',
  // idea
  content: '',
  archived: false,
  // 通用
  status: 'pending' as EventStatus,
})

const errorMsg = computed(() => {
  if (!form.title.trim()) return '请输入标题'
  if (form.type === 'calendar' && !form.event_date) return '请选择日期'
  if (form.type === 'deadline' && !form.due_date) return '请选择截止日期'
  if (form.type === 'duration') {
    if (!form.duration_date) return '请选择日期'
    if (!form.start_hm || !form.end_hm) return '请填写起止时间'
    if (form.start_hm >= form.end_hm) return '结束时间必须晚于开始时间'
  }
  return ''
})

/* ==============================================================================
 * 弹窗打开时初始化字段
 *  - 新增：根据 defaultDate + type 填合理默认值
 *  - 编辑：回填当前事件原始值（type 锁定不可改）
 * ============================================================================== */
watch(
  () => props.visible,
  (v) => {
    if (!v) return
    if (isEdit.value) {
      const e = event
      form.type = e.type
      form.title = e.title
      form.notes = e.notes
      form.status = e.status
      switch (e.type) {
        case 'calendar':
          form.event_date = e.event_date
          form.all_day = e.all_day
          form.event_time = e.event_time
          form.duration_min = e.duration_min
          break
        case 'deadline': {
          const d = dayjs(e.due_date)
          form.due_date = d.isValid() ? d.format('YYYY-MM-DD') : ''
          form.due_time =
            d.isValid() && (d.hour() !== 0 || d.minute() !== 0) ? d.format('HH:mm') : ''
          form.priority = e.priority
          break
        }
        case 'duration': {
          const s = dayjs(e.start_time)
          const t = dayjs(e.end_time)
          form.duration_date = s.isValid() ? s.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
          form.start_hm = s.isValid() ? s.format('HH:mm') : '09:00'
          form.end_hm = t.isValid() ? t.format('HH:mm') : '10:00'
          break
        }
        case 'idea':
          form.content = e.content ?? ''
          form.archived = e.archived
          break
      }
    } else {
      // —— 新增模式：用 defaultDate 作为所有日期类字段的锚点 —— //
      const d = props.defaultDate || dayjs().format('YYYY-MM-DD')
      form.type = 'calendar'
      form.title = ''
      form.notes = ''
      form.status = 'pending'
      form.event_date = d
      form.all_day = false
      form.event_time = '09:00'
      form.duration_min = null
      form.due_date = d
      form.due_time = ''
      form.priority = 'medium'
      form.duration_date = d
      form.start_hm = '09:00'
      form.end_hm = '10:00'
      form.content = ''
      form.archived = false
    }
  },
  { immediate: true },
)

/* ==============================================================================
 * 提交：生成 CreateEventInput 或 UpdateEventInput
 * ============================================================================== */
function handleSubmit() {
  if (errorMsg.value) return

  if (isEdit.value) {
    // —— 编辑：生成 patch（type 不包含，不变更）—— //
    const e = event
    const patch: UpdateEventInput = {
      title: form.title.trim(),
      notes: form.notes,
      status: form.status,
    }
    switch (e.type) {
      case 'calendar':
        patch.event_date = form.event_date
        patch.all_day = form.all_day
        patch.event_time = form.all_day ? undefined : form.event_time
        patch.duration_min = form.duration_min
        break
      case 'deadline': {
        const dt = `${form.due_date}T${form.due_time || '00:00'}:00`
        patch.due_date = new Date(dt).toISOString()
        patch.priority = form.priority
        break
      }
      case 'duration': {
        const s = new Date(`${form.duration_date}T${form.start_hm}:00`).toISOString()
        const t = new Date(`${form.duration_date}T${form.end_hm}:00`).toISOString()
        patch.start_time = s
        patch.end_time = t
        break
      }
      case 'idea':
        patch.content = form.content
        patch.archived = form.archived
        break
    }
    emit('submitUpdate', e.id, patch)
  } else {
    // —— 新增：按 type 构造 CreateEventInput —— //
    const base = {
      title: form.title.trim(),
      notes: form.notes,
      status: form.status,
    }
    let input: CreateEventInput
    switch (form.type) {
      case 'calendar':
        input = {
          ...base,
          type: 'calendar',
          event_date: form.event_date,
          all_day: form.all_day,
          event_time: form.all_day ? undefined : form.event_time,
          duration_min: form.duration_min,
        }
        break
      case 'deadline': {
        const dt = `${form.due_date}T${form.due_time || '00:00'}:00`
        input = {
          ...base,
          type: 'deadline',
          due_date: new Date(dt).toISOString(),
          priority: form.priority,
        }
        break
      }
      case 'duration': {
        const s = new Date(`${form.duration_date}T${form.start_hm}:00`).toISOString()
        const t = new Date(`${form.duration_date}T${form.end_hm}:00`).toISOString()
        input = {
          ...base,
          type: 'duration',
          start_time: s,
          end_time: t,
        }
        break
      }
      case 'idea':
        input = {
          ...base,
          type: 'idea',
          content: form.content,
          archived: form.archived,
        }
        break
    }
    emit('submitCreate', input)
  }
}

function close() {
  emit('update:visible', false)
  emit('cancel')
}

function handleDelete() {
  if (!isEdit.value) return
  const e = event
  const ok = window.confirm(`确定删除「${e.title}」吗？`)
  if (!ok) return
  emit('delete', e.id)
  emit('update:visible', false)
}

/* —— 类型 label/颜色：直接复用现有 Calendar 中已有的映射表语义 —— */
const typeLabels: Record<EventType, string> = {
  calendar: '日历事件',
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
  <!-- ===== 遮罩层：轻量磨砂，复用 glass 派生透明度 ===== -->
  <Transition name="fade">
    <div v-if="visible" class="ef-mask" @click.self="close" aria-label="新增/编辑事件">
      <BaseCard padding="md" class="ef-pop" role="dialog" aria-modal="true">
        <!-- === 头部：标题 + 类型标识 === -->
        <header class="ef-head">
          <div class="ef-head-left">
            <span class="ef-title">{{ isEdit ? '编辑事件' : '新增事件' }}</span>
            <BaseBadge v-if="form.type" :color="typeColors[form.type]">
              {{ typeLabels[form.type] }}
            </BaseBadge>
          </div>
          <BaseButton variant="ghost" size="sm" class="ef-close" @click="close" aria-label="关闭">
            ×
          </BaseButton>
        </header>

        <!-- === 表单主体 === -->
        <div class="ef-body">
          <!-- 标题（必填） -->
          <label class="ef-row">
            <span class="ef-label">标题</span>
            <BaseInput v-model="form.title" placeholder="要做什么..." />
          </label>

          <!-- 类型（新增时可切换，编辑时锁定为不可改） -->
          <div class="ef-row">
            <span class="ef-label">类型</span>
            <div class="ef-type-tabs">
              <button
                v-for="t in (['calendar', 'deadline', 'duration', 'idea'] as EventType[])"
                :key="t"
                class="ef-type-tab"
                :class="{ active: form.type === t, disabled: isEdit }"
                :disabled="isEdit"
                :style="form.type === t ? { '--tc': typeColors[t] } : undefined"
                @click="!isEdit && (form.type = t)"
              >
                {{ typeLabels[t] }}
              </button>
            </div>
          </div>

          <!-- ====== 各类型专属字段（用 transition-group 做轻切换即可）====== -->

          <!-- Calendar -->
          <template v-if="form.type === 'calendar'">
            <label class="ef-row">
              <span class="ef-label">日期</span>
              <input v-model="form.event_date" type="date" class="ef-date-input" />
            </label>
            <div class="ef-row ef-inline">
              <label class="ef-checkbox">
                <input v-model="form.all_day" type="checkbox" />
                <span>全天事件</span>
              </label>
              <label v-if="!form.all_day" class="ef-time-field">
                <span class="ef-label">时间</span>
                <input v-model="form.event_time" type="time" class="ef-time-input" />
              </label>
              <label class="ef-time-field">
                <span class="ef-label">时长（分钟）</span>
                <input
                  v-model.number="form.duration_min"
                  type="number"
                  min="0"
                  placeholder="可选"
                  class="ef-duration-input"
                />
              </label>
            </div>
          </template>

          <!-- Deadline -->
          <template v-if="form.type === 'deadline'">
            <div class="ef-row ef-inline">
              <label class="ef-date-field">
                <span class="ef-label">截止日期</span>
                <input v-model="form.due_date" type="date" class="ef-date-input" />
              </label>
              <label class="ef-time-field">
                <span class="ef-label">截止时间</span>
                <input v-model="form.due_time" type="time" class="ef-time-input" />
              </label>
            </div>
            <div class="ef-row">
              <span class="ef-label">优先级</span>
              <div class="ef-priority-tabs">
                <button
                  v-for="p in (['low', 'medium', 'high'] as Priority[])"
                  :key="p"
                  class="ef-pr-tab"
                  :class="{ active: form.priority === p }"
                  @click="form.priority = p"
                >
                  {{ p === 'low' ? '低' : p === 'medium' ? '中' : '高' }}
                </button>
              </div>
            </div>
          </template>

          <!-- Duration -->
          <template v-if="form.type === 'duration'">
            <label class="ef-row">
              <span class="ef-label">日期</span>
              <input v-model="form.duration_date" type="date" class="ef-date-input" />
            </label>
            <div class="ef-row ef-inline">
              <label class="ef-time-field">
                <span class="ef-label">开始</span>
                <input v-model="form.start_hm" type="time" class="ef-time-input" />
              </label>
              <label class="ef-time-field">
                <span class="ef-label">结束</span>
                <input v-model="form.end_hm" type="time" class="ef-time-input" />
              </label>
            </div>
          </template>

          <!-- Idea -->
          <template v-if="form.type === 'idea'">
            <label class="ef-row">
              <span class="ef-label">灵感内容</span>
              <textarea
                v-model="form.content"
                rows="3"
                placeholder="写下这一刻的想法..."
                class="ef-textarea"
              ></textarea>
            </label>
            <label class="ef-row ef-inline">
              <label class="ef-checkbox">
                <input v-model="form.archived" type="checkbox" />
                <span>已归档</span>
              </label>
            </label>
          </template>

          <!-- 通用：状态（新增时默认 pending，编辑时可改） -->
          <div class="ef-row">
            <span class="ef-label">状态</span>
            <div class="ef-status-tabs">
              <button
                v-for="s in (['pending', 'in_progress', 'completed', 'cancelled'] as EventStatus[])"
                :key="s"
                class="ef-st-tab"
                :class="{ active: form.status === s }"
                @click="form.status = s"
              >
                {{
                  s === 'pending'
                    ? '待办'
                    : s === 'in_progress'
                      ? '进行中'
                      : s === 'completed'
                        ? '已完成'
                        : '已取消'
                }}
              </button>
            </div>
          </div>

          <!-- 备注（通用，可选） -->
          <label class="ef-row">
            <span class="ef-label">备注</span>
            <textarea
              v-model="form.notes"
              rows="2"
              placeholder="可选，补充说明..."
              class="ef-textarea"
            ></textarea>
          </label>

          <!-- 校验错误 -->
          <p v-if="errorMsg" class="ef-error">{{ errorMsg }}</p>
        </div>

        <!-- === 底部：左（编辑时才有删除）/ 右：取消 / 保存 === -->
        <footer class="ef-foot">
          <BaseButton
            v-if="isEdit"
            variant="ghost"
            class="ef-delete-btn"
            @click="handleDelete"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:4px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
            删除
          </BaseButton>
          <div class="ef-foot-right">
            <BaseButton variant="ghost" @click="close">取消</BaseButton>
            <BaseButton variant="primary" :disabled="!!errorMsg" @click="handleSubmit">
              {{ isEdit ? '保存修改' : '创建' }}
            </BaseButton>
          </div>
        </footer>
      </BaseCard>
    </div>
  </Transition>
</template>

<style scoped>
/* ================= 遮罩 + 弹窗：玻璃风格，全部走 tokens.css 派生变量 ================= */
.ef-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, var(--color-primary) 22%, rgba(255, 255, 255, 0.35));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.ef-pop {
  width: min(100%, 440px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: min(90vh, 720px);
  overflow: hidden;
}

/* 头部 */
.ef-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ef-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ef-title {
  font-size: 14px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  background: var(--gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.ef-close {
  width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  line-height: 1;
  font-size: 18px;
  color: var(--color-text-tertiary);
}

/* 表单主体 */
.ef-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding-right: 2px;
}
.ef-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ef-row.ef-inline {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}
.ef-label {
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--color-text-tertiary);
  font-weight: var(--font-semibold);
}

/* 类型选择 Tabs（玻璃 pill，选中跟随事件色高亮） */
.ef-type-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.ef-type-tab {
  padding: 6px 12px;
  font-size: 11px;
  border-radius: 999px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  --tc: transparent;
}
.ef-type-tab:hover:not(.disabled) {
  background: var(--glass-bg-hover);
}
.ef-type-tab.active {
  background: color-mix(in srgb, var(--tc) 14%, var(--surface-bg));
  border-color: color-mix(in srgb, var(--tc) 30%, transparent);
  color: var(--color-text-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tc) 18%, transparent);
  font-weight: var(--font-semibold);
}
.ef-type-tab.disabled,
.ef-type-tab:disabled {
  cursor: not-allowed;
  opacity: 0.85;
}

/* 日期 / 时间 原生输入：走 surface 风格，保持一致 */
.ef-date-input,
.ef-time-input,
.ef-duration-input {
  width: 100%;
  padding: 9px 12px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  color: var(--color-text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);
}
.ef-date-input:focus,
.ef-time-input:focus,
.ef-duration-input:focus {
  border-color: var(--color-primary);
  background: var(--glass-bg-hover);
}
.ef-date-field,
.ef-time-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 120px;
}
.ef-duration-input {
  min-width: 110px;
}

/* checkbox：全天 / 已归档 */
.ef-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}
.ef-checkbox input[type='checkbox'] {
  accent-color: var(--color-primary);
}

/* 优先级 / 状态 Tabs：柔化 pill */
.ef-priority-tabs,
.ef-status-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.ef-pr-tab,
.ef-st-tab {
  padding: 5px 11px;
  font-size: 11px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent-2) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent-2) 14%, transparent);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.ef-pr-tab:hover,
.ef-st-tab:hover {
  background: var(--glass-bg-hover);
}
.ef-pr-tab.active,
.ef-st-tab.active {
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
  color: var(--color-text-primary);
  font-weight: var(--font-semibold);
}

/* Textarea：与 Input 同款 surface 风格 */
.ef-textarea {
  width: 100%;
  padding: 9px 12px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 1.55;
  resize: vertical;
  outline: none;
  font-family: inherit;
  transition: border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);
}
.ef-textarea:focus {
  border-color: var(--color-primary);
  background: var(--glass-bg-hover);
}

.ef-error {
  margin: 0;
  font-size: 11px;
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  border: 1px dashed color-mix(in srgb, var(--color-danger) 30%, transparent);
  padding: 6px 10px;
  border-radius: 10px;
}

/* 底部：主/次按钮右对齐，编辑时左侧额外放删除按钮 */
.ef-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px dashed var(--divider-color);
}
.ef-foot-right {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}
.ef-delete-btn {
  color: var(--color-danger-light) !important;
  gap: 4px;
  align-items: center;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}
.ef-delete-btn:hover {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent) !important;
  border-color: color-mix(in srgb, var(--color-danger) 28%, transparent) !important;
}

/* —— 过渡动画 —— */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* —— 小屏压缩 —— */
@media (max-width: 520px) {
  .ef-mask { padding: 12px; }
  .ef-pop { width: 100%; }
}
</style>

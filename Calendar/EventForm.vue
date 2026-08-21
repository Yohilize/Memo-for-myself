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
import DatePicker from './DatePicker.vue'
import TimePicker from './TimePicker.vue'
import { useDashboardPinnedEvent } from '@/composables/useDashboardPinnedEvent'
import type { TimeEvent, EventType, Priority, EventStatus } from '@/types/event'
import type { CreateEventInput, UpdateEventInput } from '@/services/eventTypes'
import { DEFAULT_DURATION_COLOR } from '@/services/eventService'

/**
 * 时间块色块可选色板：柔、低饱和、与 MYMEMO 暖调玻璃风格一致的几组颜色。
 * 仅用于日历中时间块的可视化，不进入业务逻辑。
 */
const DURATION_COLORS = [
  DEFAULT_DURATION_COLOR,
  '#c98f5f',
  '#a984b3',
  '#7fa6c2',
  '#c27474',
  '#9bb87e',
  '#d3a86b',
]

interface Props {
  visible: boolean
  defaultDate?: string // 'YYYY-MM-DD'，新增时的默认日期锚点
  defaultType?: EventType // 新增时的默认类型（不传则为 calendar）
  editingEvent?: TimeEvent | null
}

const props = withDefaults(defineProps<Props>(), {
  defaultDate: () => dayjs().format('YYYY-MM-DD'),
  defaultType: 'calendar',
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
const event = computed(() => props.editingEvent)
const currentEventId = computed(() => event.value?.id ?? '')
const { isEventPinned, toggleEventPinned } = useDashboardPinnedEvent()

// —— 受控表单字段（全部可选，提交时按 CreateEventInput 收敛校验）—— //
type TypeSelectable = EventType
const form = reactive({
  type: 'calendar' as TypeSelectable,
  title: '',
  notes: '',
  // calendar
  event_date: '',
  // 「无时间要求」默认开启：仅需日期，无需具体时间
  all_day: true,
  event_time: '09:00',
  duration_min: null as number | null,
  // deadline
  due_date: '',
  due_time: '',
  priority: 'medium' as Priority,
  // duration
  start_date: '',
  end_date: '',
  dur_color: DEFAULT_DURATION_COLOR,
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
    if (!form.start_date) return '请选择开始日期'
    if (form.end_date && form.end_date < form.start_date) return '结束日期不能早于开始日期'
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
      const e = event.value
      if (!e) return
      form.type = e.type
      form.title = e.title
      form.notes = e.notes
      // idea 无任务状态，仅归档管理；任务类型才回填 status
      if (e.type !== 'idea') form.status = e.status
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
        case 'duration':
          form.start_date = e.start_date
          form.end_date = e.end_date ?? ''
          form.dur_color = e.color ?? DEFAULT_DURATION_COLOR
          break
        case 'idea':
          form.content = e.content ?? ''
          form.archived = e.archived
          break
      }
    } else {
      // —— 新增模式：用 defaultDate 作为所有日期类字段的锚点；defaultType 作为初始类型 —— //
      const d = props.defaultDate || dayjs().format('YYYY-MM-DD')
      form.type = props.defaultType ?? 'calendar'
      form.title = ''
      form.notes = ''
      // 新建行程默认「无状态」；deadline / duration 才默认 pending
      form.status = form.type === 'calendar' ? 'stateless' : 'pending'
      form.event_date = d
      // 「无时间要求」默认开启：仅需日期，无需具体时间
      form.all_day = true
      form.event_time = '09:00'
      form.duration_min = null
      form.due_date = d
      form.due_time = ''
      form.priority = 'medium'
      // duration：开始日期默认今天；结束日期默认留空（未知结束的开放区块）
      form.start_date = dayjs().format('YYYY-MM-DD')
      form.end_date = ''
      form.dur_color = DEFAULT_DURATION_COLOR
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
    const e = event.value
    if (!e) return
    const patch: UpdateEventInput = {
      title: form.title.trim(),
      notes: form.notes,
      // idea 不参与任务状态（沿用归档机制），不写入 status；其余类型保留状态编辑能力
      ...(e.type !== 'idea' ? { status: form.status } : {}),
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
      case 'duration':
          patch.start_date = form.start_date
          patch.end_date = form.end_date || null
          patch.color = form.dur_color
          break
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
      case 'duration':
          input = {
            ...base,
            type: 'duration',
            start_date: form.start_date,
            end_date: form.end_date || null,
            color: form.dur_color,
          }
          break
      case 'idea':
        // idea 不参与任务状态：不写 status，让 service 默认 pending，后续仅靠归档管理
        input = {
          title: form.title.trim(),
          notes: form.notes,
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
  const e = event.value
  if (!e) return
  emit('delete', e.id)
  emit('update:visible', false)
}

/* —— 类型 label/颜色：直接复用现有 Calendar 中已有的映射表语义 —— */
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

/* —— 状态标签：calendar / deadline / duration 均支持「无状态」；idea 无任务状态语义 —— */
const statusOptions = computed<EventStatus[]>(() => {
  if (form.type === 'idea') return []
  return ['stateless', 'pending', 'in_progress', 'completed', 'cancelled']
})

function statusTabLabel(s: EventStatus): string {
  switch (s) {
    case 'stateless':
      return '无状态'
    case 'pending':
      return '待办'
    case 'in_progress':
      return '进行中'
    case 'completed':
      return '已完成'
    case 'cancelled':
      return '已取消'
  }
}

// 新增模式下切换类型时，若当前状态不在新类型的允许集合内则回退到该类型默认值
watch(
  () => form.type,
  (t) => {
    if (t === 'idea') return
    const allowed = statusOptions.value
    if (!allowed.includes(form.status)) {
      form.status = t === 'calendar' ? 'stateless' : 'pending'
    }
  },
)
</script>

<template>
  <!--
    ===== 遮罩层：轻量磨砂，复用 glass 派生透明度 =====
    通过 Teleport 挂载到 body：
    弹窗常被渲染在 Dashboard 的小组件（如日历 widget，z-index:1 的 stacking context）内部，
    若就地 fixed，其内部再高的 z-index 也越不过兄弟 widget（如"固定事件"Pin），
    导致 Pin 不被遮罩。Teleport 到 body 让遮罩成为最顶层，统一压盖所有 Dashboard 内容。
  -->
  <Teleport to="body">
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

          <!-- Calendar / 行程 -->
          <template v-if="form.type === 'calendar'">
            <div class="ef-row">
              <span class="ef-label">日期</span>
              <DatePicker v-model="form.event_date" />
            </div>

            <!-- 「无时间要求」开关：开启仅需日期；关闭时显示具体时间（含滚轮式时间选择器） -->
            <div class="ef-row">
              <div class="ef-switch-field">
                <div class="ef-switch-row">
                  <span class="ef-label">无时间要求</span>
                  <button
                    type="button"
                    class="ef-switch"
                    :class="{ 'is-on': form.all_day }"
                    role="switch"
                    aria-label="无时间要求"
                    :aria-checked="form.all_day"
                    @click="form.all_day = !form.all_day"
                  >
                    <span class="ef-switch-knob"></span>
                  </button>
                </div>
                <p class="ef-field-hint">
                  {{ form.all_day ? '仅需选择日期，无需设置具体时间' : '已关闭：请设置行程具体时间' }}
                </p>
              </div>
            </div>

            <div v-if="!form.all_day" class="ef-row ef-inline">
              <div class="ef-time-field">
                <span class="ef-label">时间</span>
                <TimePicker v-model="form.event_time" />
              </div>
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
              <div class="ef-date-field">
                <span class="ef-label">截止日期</span>
                <DatePicker v-model="form.due_date" />
              </div>
              <div class="ef-time-field">
                <span class="ef-label">截止时间</span>
                <TimePicker v-model="form.due_time" placeholder="无具体时间" allow-clear />
              </div>
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

          <!-- Duration / 时间块 -->
          <template v-if="form.type === 'duration'">
            <div class="ef-row">
              <span class="ef-label">开始日期</span>
              <DatePicker v-model="form.start_date" />
            </div>
            <div class="ef-row">
              <span class="ef-label">结束日期</span>
              <DatePicker
                v-model="form.end_date"
                placeholder="暂不设置（进行中）"
                allow-clear
              />
            </div>
            <div class="ef-row">
              <span class="ef-label">颜色</span>
              <div class="ef-color-row">
                <button
                  v-for="c in DURATION_COLORS"
                  :key="c"
                  type="button"
                  class="ef-color-swatch"
                  :class="{ active: form.dur_color === c }"
                  :style="{ background: c }"
                  :aria-label="`颜色 ${c}`"
                  :title="c"
                  @click="form.dur_color = c"
                ></button>
              </div>
            </div>
            <p class="ef-field-hint">
              不设结束日期表示该时间块已开始、结束日期待定；可在日历中双击其开始日期来补设结束日期。
            </p>
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

          <!-- 通用：状态（idea 无任务状态语义，不显示；行程支持无状态/待办等；deadline/duration 仅任务状态） -->
          <div v-if="form.type !== 'idea'" class="ef-row">
            <span class="ef-label">状态</span>
            <div class="ef-status-tabs">
              <button
                v-for="s in statusOptions"
                :key="s"
                class="ef-st-tab"
                :class="{ active: form.status === s }"
                @click="form.status = s"
              >
                {{ statusTabLabel(s) }}
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
          <div class="ef-foot-left">
            <label v-if="isEdit" class="ef-pin-toggle">
              <input
                type="checkbox"
                :checked="isEventPinned(currentEventId)"
                @change="toggleEventPinned(currentEventId)"
              />
              <span>固定到仪表盘</span>
            </label>
            <BaseButton
              v-if="isEdit"
              variant="ghost"
              class="ef-delete-btn"
              @click="handleDelete"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:4px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
              删除
            </BaseButton>
          </div>
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
  </Teleport>
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
  /* 暖色半透明遮罩：加深不透明度，确保弹窗打开时背后的内容被明显压暗，保持玻璃拟态 */
  background: color-mix(in srgb, var(--color-primary) 45%, rgba(255, 255, 255, 0.28));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
/* 弹窗本体：用更高不透明度的玻璃（--glass-bg-active）叠暖米白底色，
   避免 BaseCard 默认 --glass-bg(≈50%) 过透而透出后面内容 */
.ef-mask .ef-pop {
  background: color-mix(in srgb, var(--glass-bg-active) 94%, var(--color-bg-base));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
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

/* 「无时间要求」开关：玻璃质感 switch */
.ef-switch-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.ef-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.ef-switch-row .ef-label {
  margin-bottom: 0;
}
.ef-switch {
  position: relative;
  flex: 0 0 auto;
  width: 40px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text-tertiary) 18%, transparent);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.ef-switch .ef-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22);
  transition: transform var(--duration-fast) var(--ease-out);
}
.ef-switch.is-on {
  background: var(--gradient-primary);
  border-color: transparent;
}
.ef-switch.is-on .ef-switch-knob {
  transform: translateX(18px);
}
.ef-field-hint {
  margin: 0;
  font-size: 10px;
  line-height: 1.4;
  color: var(--color-text-tertiary);
}

/* 时间块色块：圆形小 swatch，激活项描边 + 轻微上浮 */
.ef-color-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.ef-color-swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #000 8%, transparent);
  transition:
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.ef-color-swatch:hover {
  transform: scale(1.12);
}
.ef-color-swatch.active {
  transform: scale(1.12);
  box-shadow:
    inset 0 0 0 1px transparent,
    0 0 0 2px var(--color-bg-base),
    0 0 0 3.5px var(--color-primary);
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
.ef-foot-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.ef-pin-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-secondary);
  font-size: 11px;
  cursor: pointer;
  user-select: none;
}
.ef-pin-toggle input {
  accent-color: var(--color-primary);
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

<script setup lang="ts">
/**
 * EventEditPanel — 通用「事件编辑界面」。
 *
 * 设计定位：
 *  - 所有页面「点击事件进入编辑」统一使用本面板，只传入 eventId，
 *    内部按 eventId 从 useEventStore 实时解析真实事件，保证始终编辑最新数据。
 *  - 保存统一走 eventStore.update(id, patch) → Service → Repository → IndexedDB，
 *    Pinia 响应式自动同步到所有界面。数据入口 / 编辑逻辑统一；不同页面如需不同
 *    样式，可通过本组件 props（variant 等）或外部覆盖实现，不影响此处逻辑。
 *  - 与「新增事件」窗口（EventForm）相互独立：本面板只管编辑，不影响新增流程。
 *
 * 布局：标题 / 状态 / 类型（锁定-解锁切换）/ 备注主区域 / 保存。
 */
import { computed, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import DatePicker from '@calendar/DatePicker.vue'
import TimePicker from '@calendar/TimePicker.vue'
import { useEventStore } from '@/stores/eventStore'
import type { EventStatus, EventType, Priority, TimeEvent } from '@/types/event'
import type { UpdateEventInput } from '@/services/eventTypes'
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

const props = defineProps<{
  visible: boolean
  eventId: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const eventStore = useEventStore()

/** 受控草稿字段（与 EventForm 同一套字段语义，便于将来复用其构造逻辑）。 */
const form = reactive({
  type: 'calendar' as EventType,
  title: '',
  notes: '',
  event_date: '',
  all_day: true,
  event_time: '09:00',
  duration_min: null as number | null,
  due_date: '',
  due_time: '',
  priority: 'medium' as Priority,
  start_date: '',
  end_date: '',
  dur_color: DEFAULT_DURATION_COLOR,
  content: '',
  archived: false,
  status: 'pending' as EventStatus,
})

// —— 类型锁定：默认锁定，解锁后才展示类型切换选项；仅控制编辑权限，不改变事件本身 —— //
const typeLocked = ref(true)

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
const TYPE_OPTIONS: EventType[] = ['calendar', 'deadline', 'duration', 'idea']

/** 状态切换（本次仅支持三态）：无状态 / 未完成 / 已完成。 */
const statusSegments = computed<{ key: EventStatus; label: string }[]>(() => {
  if (form.type === 'idea') return []
  return [
    { key: 'stateless', label: '无状态' },
    { key: 'pending', label: '未完成' },
    { key: 'completed', label: '已完成' },
  ]
})

/* ==============================================================================
 * 打开面板时回填事件原始值；类型默认锁定。
 * ============================================================================== */
function loadEvent(e: TimeEvent): void {
  form.type = e.type
  form.title = e.title
  form.notes = e.notes
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
}

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    typeLocked.value = true // 每次打开默认锁定类型
    if (!props.eventId) return
    const e = eventStore.events.find((x) => x.id === props.eventId)
    if (e) loadEvent(e)
  },
  { immediate: true },
)

/* ==============================================================================
 * 类型切换：为新类型初始化字段（保留标题 / 备注 / 编辑权限不受影响）。
 * ============================================================================== */
function applyTypeDefaults(t: EventType): void {
  form.type = t
  form.status = t === 'calendar' ? 'stateless' : 'pending'
  form.event_date = dayjs().format('YYYY-MM-DD')
  form.all_day = true
  form.event_time = '09:00'
  form.duration_min = null
  form.due_date = dayjs().format('YYYY-MM-DD')
  form.due_time = ''
  form.priority = 'medium'
  form.start_date = dayjs().format('YYYY-MM-DD')
  form.end_date = ''
  form.dur_color = DEFAULT_DURATION_COLOR
  form.content = ''
  form.archived = false
}

function onTypeSelect(t: EventType): void {
  if (form.type === t) return
  applyTypeDefaults(t)
}

/* —— 校验 —— */
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
 * 提交：按当前 form.type 生成 UpdateEventInput 并统一保存。
 * ============================================================================== */
async function handleSubmit(): Promise<void> {
  if (errorMsg.value || !props.eventId) return
  const patch: UpdateEventInput = {
    type: form.type,
    title: form.title.trim(),
    notes: form.notes,
    // 非 idea 才写状态；idea 无任务状态（沿用归档机制）
    ...(form.type !== 'idea' ? { status: form.status } : {}),
  }
  switch (form.type) {
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
  try {
    await eventStore.update(props.eventId, patch)
    emit('close')
  } catch (_err) {
    /* eventStore.error 已持有；面板保持打开 */
  }
}

function setStatus(s: EventStatus): void {
  form.status = s
}
</script>

<template>
  <Teleport to="body">
    <Transition name="eep-fade">
      <div v-if="visible" class="eep-mask" @click.self="emit('close')" aria-label="编辑事件">
        <div class="eep-panel" role="dialog" aria-modal="true">
          <!-- 头部：标题标签 + 标题编辑框 + 关闭 -->
          <header class="eep-head">
            <span class="eep-label eep-title-label">标题</span>
            <BaseInput v-model="form.title" class="eep-title" placeholder="事件标题..." />
            <BaseButton variant="ghost" size="sm" class="eep-close" aria-label="关闭" @click="emit('close')">
              ×
            </BaseButton>
          </header>

          <!-- 状态行（idea 无任务状态，不显示） -->
          <section v-if="form.type !== 'idea'" class="eep-block">
            <span class="eep-label">状态</span>
            <div class="eep-status-row">
              <button
                v-for="seg in statusSegments"
                :key="seg.key"
                type="button"
                class="eep-status-seg"
                :class="{ active: form.status === seg.key }"
                @click="setStatus(seg.key)"
              >
                {{ seg.label }}
              </button>
            </div>
          </section>

          <!-- 类型行：默认锁定；解锁后才显示类型切换 + 类型字段 -->
          <section class="eep-block">
            <div class="eep-type-head">
              <span class="eep-label">类型</span>
              <button
                type="button"
                class="eep-lock-btn"
                :class="{ locked: !typeLocked }"
                :title="typeLocked ? '解锁后可切换类型' : '锁定类型'"
                :aria-label="typeLocked ? '解锁类型' : '锁定类型'"
                @click="typeLocked = !typeLocked"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect v-if="typeLocked" x="4" y="11" width="16" height="10" rx="2" />
                  <path v-if="typeLocked" d="M8 11V7a4 4 0 0 1 8 0v4" />
                  <path v-else d="M6 9l4 4m0-4l-4 4m6-9h.01M10 4h.01M14 6h.01M6 18h.01M18 6h.01M18 18h.01M20 10h.01M20 14h.01M20 18h.01" />
                </svg>
                <span class="eep-lock-text">{{ typeLocked ? '锁定' : '解锁' }}</span>
              </button>
            </div>

            <!-- 类型切换选项（解锁后展示） -->
            <div v-if="!typeLocked" class="eep-type-tabs">
              <button
                v-for="t in TYPE_OPTIONS"
                :key="t"
                type="button"
                class="eep-type-tab"
                :class="{ active: form.type === t }"
                :style="form.type === t ? { '--tc': typeColors[t] } : undefined"
                @click="onTypeSelect(t)"
              >
                {{ typeLabels[t] }}
              </button>
            </div>

            <!-- 类型字段（锁定态也展示当前类型的字段以供编辑） -->
            <div class="eep-type-fields">
              <!-- Calendar -->
              <template v-if="form.type === 'calendar'">
                <div class="eep-field">
                  <span class="eep-label">日期</span>
                  <DatePicker v-model="form.event_date" />
                </div>
                <div class="eep-field">
                  <div class="eep-switch-row">
                    <span class="eep-label">无时间要求</span>
                    <button
                      type="button"
                      class="eep-switch"
                      :class="{ 'is-on': form.all_day }"
                      role="switch"
                      :aria-checked="form.all_day"
                      @click="form.all_day = !form.all_day"
                    >
                      <span class="eep-switch-knob"></span>
                    </button>
                  </div>
                </div>
                <div v-if="!form.all_day" class="eep-field eep-inline">
                  <div class="eep-half">
                    <span class="eep-label">时间</span>
                    <TimePicker v-model="form.event_time" />
                  </div>
                  <label class="eep-half">
                    <span class="eep-label">时长（分钟）</span>
                    <input
                      v-model.number="form.duration_min"
                      type="number"
                      min="0"
                      placeholder="可选"
                      class="eep-input"
                    />
                  </label>
                </div>
              </template>

              <!-- Deadline -->
              <template v-else-if="form.type === 'deadline'">
                <div class="eep-field eep-inline">
                  <div class="eep-half">
                    <span class="eep-label">截止日期</span>
                    <DatePicker v-model="form.due_date" />
                  </div>
                  <div class="eep-half">
                    <span class="eep-label">截止时间</span>
                    <TimePicker v-model="form.due_time" placeholder="无具体时间" allow-clear />
                  </div>
                </div>
                <div class="eep-field">
                  <span class="eep-label">优先级</span>
                  <div class="eep-pill-row">
                    <button
                      v-for="p in (['low', 'medium', 'high'] as Priority[])"
                      :key="p"
                      type="button"
                      class="eep-pill"
                      :class="{ active: form.priority === p }"
                      @click="form.priority = p"
                    >
                      {{ p === 'low' ? '低' : p === 'medium' ? '中' : '高' }}
                    </button>
                  </div>
                </div>
              </template>

              <!-- Duration -->
              <template v-else-if="form.type === 'duration'">
                <div class="eep-field">
                  <span class="eep-label">开始日期</span>
                  <DatePicker v-model="form.start_date" />
                </div>
                <div class="eep-field">
                  <span class="eep-label">结束日期</span>
                  <DatePicker v-model="form.end_date" placeholder="暂不设置（进行中）" allow-clear />
                </div>
                <div class="eep-field">
                  <span class="eep-label">颜色</span>
                  <div class="eep-color-row">
                    <button
                      v-for="c in DURATION_COLORS"
                      :key="c"
                      type="button"
                      class="eep-swatch"
                      :class="{ active: form.dur_color === c }"
                      :style="{ background: c }"
                      :aria-label="`颜色 ${c}`"
                      :title="c"
                      @click="form.dur_color = c"
                    ></button>
                  </div>
                </div>
              </template>

              <!-- Idea -->
              <template v-else>
                <div class="eep-field">
                  <span class="eep-label">灵感内容</span>
                  <textarea
                    v-model="form.content"
                    rows="2"
                    placeholder="写下这一刻的想法..."
                    class="eep-textarea-sm"
                  ></textarea>
                </div>
                <label class="eep-checkbox">
                  <input v-model="form.archived" type="checkbox" />
                  <span>已归档</span>
                </label>
              </template>
            </div>
          </section>

          <!-- 备注（主区域）：占主体，方便快速查看大量文本 -->
          <section class="eep-notes">
            <span class="eep-label">备注</span>
            <textarea
              v-model="form.notes"
              class="eep-notes-text"
              placeholder="补充说明..."
            ></textarea>
          </section>

          <p v-if="errorMsg" class="eep-error">{{ errorMsg }}</p>

          <!-- 底部：取消 / 保存 -->
          <footer class="eep-foot">
            <BaseButton variant="ghost" @click="emit('close')">取消</BaseButton>
            <BaseButton variant="primary" :disabled="!!errorMsg" @click="handleSubmit">
              保存修改
            </BaseButton>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ============ 遮罩 + 面板：玻璃风格，全走 Design Token ============ */
.eep-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, var(--color-primary) 45%, rgba(255, 255, 255, 0.28));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.eep-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(100%, 480px);
  /* 窗口高度约屏幕 2/3 的 4/5；备注区（flex:1）负责吸收缩减空间 */
  height: min(calc(66vh * 0.8), 656px);
  padding: 20px 22px;
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  background: color-mix(in srgb, var(--glass-bg-active) 94%, var(--color-bg-base));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  overflow: hidden;
}

/* —— 头部 —— */
.eep-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.eep-title-label {
  flex: 0 0 auto;
  white-space: nowrap;
}
.eep-title {
  flex: 1;
  font-size: 16px;
  font-weight: var(--font-semibold);
}
.eep-close {
  width: 34px !important;
  height: 34px !important;
  padding: 0 !important;
  font-size: 20px;
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* —— 通用块 —— */
.eep-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.eep-label {
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--color-text-tertiary);
  font-weight: var(--font-semibold);
}

/* —— 状态行 —— */
.eep-status-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.eep-status-seg {
  min-height: 32px;
  padding: 0 16px;
  font-size: 12px;
  border-radius: 999px;
  border: 1px solid var(--surface-border);
  background: color-mix(in srgb, var(--color-accent-2) 8%, transparent);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.eep-status-seg.active {
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
  color: var(--color-text-primary);
  font-weight: var(--font-semibold);
}

/* —— 类型行 —— */
.eep-type-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.eep-lock-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 999px;
  border: 1px solid var(--surface-border);
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.eep-lock-btn.locked {
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.eep-lock-text {
  line-height: 1;
}
.eep-type-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.eep-type-tab {
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
.eep-type-tab.active {
  background: color-mix(in srgb, var(--tc) 14%, var(--surface-bg));
  border-color: color-mix(in srgb, var(--tc) 30%, transparent);
  color: var(--color-text-primary);
  font-weight: var(--font-semibold);
}
.eep-type-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 2px;
}
.eep-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.eep-field.eep-inline {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 10px;
}
.eep-half {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 130px;
}
.eep-input {
  width: 100%;
  padding: 9px 12px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  color: var(--color-text-primary);
  font-size: 13px;
  outline: none;
  font-family: inherit;
}
.eep-input:focus,
.eep-notes-text:focus,
.eep-textarea-sm:focus {
  border-color: var(--color-primary);
  background: var(--glass-bg-hover);
}
.eep-pill-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.eep-pill {
  padding: 5px 11px;
  font-size: 11px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-accent-2) 14%, transparent);
  background: color-mix(in srgb, var(--color-accent-2) 10%, transparent);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.eep-pill.active {
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
  color: var(--color-text-primary);
  font-weight: var(--font-semibold);
}
.eep-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.eep-switch {
  position: relative;
  flex: 0 0 auto;
  width: 40px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text-tertiary) 18%, transparent);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}
.eep-switch .eep-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22);
  transition: transform var(--duration-fast) var(--ease-out);
}
.eep-switch.is-on {
  background: var(--gradient-primary);
  border-color: transparent;
}
.eep-switch.is-on .eep-switch-knob {
  transform: translateX(18px);
}
.eep-color-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.eep-swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #000 8%, transparent);
  transition: transform var(--duration-fast) var(--ease-out);
}
.eep-swatch.active {
  transform: scale(1.12);
  box-shadow:
    inset 0 0 0 1px transparent,
    0 0 0 2px var(--color-bg-base),
    0 0 0 3.5px var(--color-primary);
}
.eep-textarea-sm {
  width: 100%;
  min-height: 60px;
  padding: 9px 12px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  font-family: inherit;
}
.eep-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}
.eep-checkbox input {
  accent-color: var(--color-primary);
}

/* —— 备注主区域：占主体，延展到上下之间 —— */
.eep-notes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 180px;
}
.eep-notes-text {
  flex: 1;
  width: 100%;
  min-height: 160px;
  padding: 12px 14px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
  font-family: inherit;
}

.eep-error {
  margin: 0;
  font-size: 11px;
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  border: 1px dashed color-mix(in srgb, var(--color-danger) 30%, transparent);
  padding: 6px 10px;
  border-radius: 10px;
}

/* —— 底部 —— */
.eep-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px dashed var(--divider-color);
}

.eep-fade-enter-active,
.eep-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}
.eep-fade-enter-from,
.eep-fade-leave-to {
  opacity: 0;
}

@media (max-width: 520px) {
  .eep-mask { padding: 12px; }
  .eep-panel { width: 100%; }
}
</style>
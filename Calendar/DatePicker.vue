<template>
  <div ref="rootEl" class="dp">
    <!-- 触发器：显示当前日期，点击弹出紧凑月历 -->
    <button
      type="button"
      ref="trigger"
      class="dp-trigger"
      :aria-haspopup="true"
      :aria-expanded="open"
      :title="modelValue"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" stroke-width="1.8" />
        <path d="M3 9h18M8 3v3M16 3v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      <span class="dp-value" :class="{ 'is-empty': !isSet }">{{ display }}</span>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <Teleport to="body">
      <Transition name="dp-fade">
        <div
          v-if="open"
          ref="panelEl"
          class="dp-panel"
          :style="panelStyle"
          role="dialog"
          aria-label="选择日期"
        >
          <div class="dp-head">
            <button type="button" class="dp-nav" aria-label="上个月" @click="shiftMonth(-1)">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <div class="dp-title" aria-live="polite">
              <span class="dp-year">{{ viewDate.year() }}年</span>
              <span class="dp-month">{{ viewDate.month() + 1 }}月</span>
            </div>
            <button type="button" class="dp-nav" aria-label="下个月" @click="shiftMonth(1)">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <div class="dp-week" aria-hidden="true">
            <span v-for="w in weekdays" :key="w">{{ w }}</span>
          </div>

          <div class="dp-grid" role="grid" aria-label="月历">
            <button
              v-for="cell in cells"
              :key="cell.key"
              type="button"
              role="gridcell"
              class="dp-day"
              :class="{
                'is-out': !cell.inMonth,
                'is-selected': cell.iso === modelValue,
                'is-today': cell.iso === todayIso,
              }"
              :tabindex="cell.inMonth ? 0 : -1"
              @click="pick(cell)"
            >
              {{ cell.day }}
            </button>
          </div>

          <div class="dp-foot">
            <button type="button" class="dp-today" @click="pickToday">今天</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import dayjs, { type Dayjs } from 'dayjs'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string // 'YYYY-MM-DD'
    placeholder?: string // 未设置日期时触发器的占位文本
  }>(),
  {
    placeholder: '选择日期',
  },
)
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const trigger = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const isSet = computed(() => !!props.modelValue && dayjs(props.modelValue).isValid())
const todayIso = dayjs().format('YYYY-MM-DD')

/** 触发器展示文案：同年只显「M月D日」，跨年则带年份，避免歧义 */
const display = computed(() => {
  if (!isSet.value) return props.placeholder
  const d = dayjs(props.modelValue)
  return d.year() === dayjs().year()
    ? d.format('M月D日')
    : `${d.year()}年${d.format('M月D日')}`
})

/** 当前浏览的月份（新增/编辑按 modelValue 定位，为空则跳今天所在的月） */
const viewDate = ref(dayjs())
function toViewDate(): Dayjs {
  const base = isSet.value ? dayjs(props.modelValue) : dayjs()
  return base.startOf('month')
}

const daysInMonth = computed(() => viewDate.value.daysInMonth())
const prependDays = computed(() => viewDate.value.day()) // 当月 1 号是星期几（0=周日）

interface DayCell {
  key: string
  iso: string
  day: number
  inMonth: boolean
}
const cells = computed<DayCell[]>(() => {
  const first = viewDate.value
  const list: DayCell[] = []
  // 上个月的占位
  for (let i = prependDays.value; i > 0; i--) {
    const d = first.subtract(i, 'day')
    list.push({ key: `p-${d.unix()}`, iso: d.format('YYYY-MM-DD'), day: d.date(), inMonth: false })
  }
  // 当月
  for (let day = 1; day <= daysInMonth.value; day++) {
    const d = first.date(day)
    list.push({ key: `c-${day}`, iso: d.format('YYYY-MM-DD'), day, inMonth: true })
  }
  // 补齐末尾到整行（7 列）
  const nextMonth = first.add(1, 'month')
  const remain = list.length % 7
  if (remain > 0) {
    for (let i = 1; i <= 7 - remain; i++) {
      const d = nextMonth.date(i)
      list.push({ key: `n-${d.unix()}`, iso: d.format('YYYY-MM-DD'), day: i, inMonth: false })
    }
  }
  return list
})

function pick(cell: DayCell): void {
  emit('update:modelValue', cell.iso)
  viewDate.value = dayjs(cell.iso).startOf('month')
  close()
}
function pickToday(): void {
  emit('update:modelValue', todayIso)
  viewDate.value = dayjs()
  close()
}
function shiftMonth(step: number): void {
  viewDate.value = viewDate.value.add(step, 'month').startOf('month')
}

function toggle(): void {
  open.value ? close() : openPanel()
}
function close(): void {
  open.value = false
}
function openPanel(): void {
  if (!trigger.value) return
  viewDate.value = toViewDate()
  const r = trigger.value.getBoundingClientRect()
  const panelW = 264
  const panelH = 312
  panelStyle.value = {
    top: `${Math.max(8, Math.min(r.bottom + 6, window.innerHeight - panelH - 8))}px`,
    left: `${Math.max(8, Math.min(r.left, window.innerWidth - panelW - 8))}px`,
  }
  open.value = true
}

/** 点击面板外关闭 */
function onDocDown(e: MouseEvent): void {
  const t = e.target as Node
  if (panelEl.value?.contains(t) || trigger.value?.contains(t)) return
  close()
}
watch(open, (v) => {
  if (v) document.addEventListener('mousedown', onDocDown)
  else document.removeEventListener('mousedown', onDocDown)
})
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocDown))
</script>

<style scoped>
.dp {
  position: relative;
  width: 100%;
  min-width: 0;
}
.dp-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 38px;
  padding: 0 10px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  color: var(--color-text-primary);
  font-size: 13px;
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.dp-trigger:hover,
.dp-trigger:focus-visible {
  outline: none;
  background: var(--surface-bg-hover);
  border-color: var(--color-primary);
}
.dp-trigger svg {
  color: var(--color-text-tertiary);
  flex: 0 0 auto;
}
.dp-value {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dp-value.is-empty {
  color: var(--color-text-tertiary);
}

.dp-panel {
  position: fixed;
  z-index: 10050;
  width: 264px;
  padding: 10px 12px 8px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--glass-bg-active) 96%, var(--color-bg-base));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}

.dp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.dp-title {
  display: flex;
  align-items: baseline;
  gap: 4px;
  user-select: none;
}
.dp-year {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.dp-month {
  font-size: 15px;
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
}
.dp-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}
.dp-nav:hover {
  background: var(--glass-bg-hover);
  color: var(--color-primary);
}

.dp-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}
.dp-week span {
  text-align: center;
  font-size: 9px;
  color: var(--color-text-tertiary);
  height: 20px;
  line-height: 20px;
}

.dp-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.dp-day {
  height: 32px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.dp-day:hover {
  background: var(--surface-bg-hover);
}
.dp-day.is-out {
  color: color-mix(in srgb, var(--color-text-tertiary) 70%, transparent);
}
.dp-day.is-today:not(.is-selected) {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 45%, transparent);
}
.dp-day.is-selected {
  background: var(--gradient-primary);
  color: var(--color-text-on-gradient);
  font-weight: var(--font-bold);
  box-shadow: var(--glass-shadow);
}

.dp-foot {
  display: flex;
  justify-content: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--glass-border);
}
.dp-today {
  border: none;
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: opacity var(--duration-fast) var(--ease-out);
}
.dp-today:hover {
  opacity: 0.75;
}

.dp-fade-enter-active,
.dp-fade-leave-active {
  transition:
    opacity 0.14s var(--ease-out),
    transform 0.14s var(--ease-out);
}
.dp-fade-enter-from,
.dp-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
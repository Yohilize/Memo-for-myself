<template>
  <div ref="rootEl" class="tp">
    <!-- 触发器：显示当前时间，点击弹出小时/分钟滚轮 -->
    <button
      type="button"
      ref="trigger"
      class="tp-trigger"
      :aria-haspopup="true"
      :aria-expanded="open"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
        <path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="tp-value" :class="{ 'is-empty': !isSet }">{{ display }}</span>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <Teleport to="body">
      <Transition name="tp-fade">
        <div
          v-if="open"
          ref="panelEl"
          class="tp-panel"
          :style="panelStyle"
          role="listbox"
          aria-label="选择时间"
        >
          <div class="tp-cols">
            <div class="tp-col">
              <span class="tp-col-label">时</span>
              <div ref="hourListEl" class="tp-list">
                <button
                  v-for="h in hours"
                  :key="h"
                  type="button"
                  class="tp-item"
                  :class="{ active: h === activeHour }"
                  role="option"
                  :aria-selected="h === activeHour"
                  :data-active="h === activeHour ? 'y' : undefined"
                  @click="selectHour(h)"
                >
                  {{ h }}
                </button>
              </div>
            </div>
            <span class="tp-colon">:</span>
            <div class="tp-col">
              <span class="tp-col-label">分</span>
              <div ref="minuteListEl" class="tp-list">
                <button
                  v-for="m in minutes"
                  :key="m"
                  type="button"
                  class="tp-item"
                  :class="{ active: m === minuteStepActive }"
                  role="option"
                  :aria-selected="m === minuteStepActive"
                  :data-active="m === minuteStepActive ? 'y' : undefined"
                  @click="selectMinute(m)"
                >
                  {{ m }}
                </button>
              </div>
            </div>
          </div>
          <div v-if="allowClear && isSet" class="tp-foot">
            <button type="button" class="tp-clear" @click="clear">清除时间</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * TimePicker — 紧凑型玻璃风格时间选择器。
 *
 * 模型值是 'HH:mm' 字符串（空字符串代表「未设置具体时间」，供可选的截止时间使用），
 * 仅替换视觉交互（小时/分钟两列滚轮），不改变数据格式与保存语义。
 * 分钟采用 5 分钟粒度（00/05/…/55），保持桌面端紧凑、易操作。
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string // 'HH:mm'（空字符串表示未设置具体时间）
    placeholder?: string // 未设置时间时触发器的占位文本
    allowClear?: boolean // 是否允许清除为未设置（可选时间场景，如 Deadline 截止时间）
  }>(),
  {
    placeholder: 'HH:mm',
    allowClear: false,
  },
)
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const trigger = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const hourListEl = ref<HTMLElement | null>(null)
const minuteListEl = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const hours: string[] = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const minutes: string[] = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, '0'),
)

/** 从 'HH:mm' 解析出小时 / 分钟 */
const parts = computed(() => /^(\d{2}):(\d{2})$/.exec(props.modelValue))
const isSet = computed(() => !!parts.value)
const hour = computed(() => parts.value?.[1] ?? '09')
const minute = computed(() => parts.value?.[2] ?? '00')

/** 滚轮中用于高亮的小时 / 分钟（未设置时间时不高亮，避免误读） */
const activeHour = computed(() => (isSet.value ? hour.value : ''))
const minuteStepActive = computed(() => {
  if (!isSet.value) return ''
  const n = Math.round(parseInt(minute.value, 10) / 5) * 5
  return String(n % 60).padStart(2, '0')
})

const display = computed(() => (isSet.value ? `${hour.value}:${minute.value}` : props.placeholder))

function selectHour(h: string): void {
  emit('update:modelValue', `${h}:${isSet.value ? minute.value : '00'}`)
}
function selectMinute(m: string): void {
  emit('update:modelValue', `${hour.value}:${m}`)
}
function clear(): void {
  emit('update:modelValue', '')
}

function toggle(): void {
  open.value ? close() : openPanel()
}
function close(): void {
  open.value = false
}
function openPanel(): void {
  if (!trigger.value) return
  const r = trigger.value.getBoundingClientRect()
  const panelW = 150
  const panelH = 230
  panelStyle.value = {
    top: `${Math.max(8, Math.min(r.bottom + 6, window.innerHeight - panelH - 8))}px`,
    left: `${Math.max(8, Math.min(r.left, window.innerWidth - panelW - 8))}px`,
  }
  open.value = true
}

/** 打开时把当前值滚到两列可视区中央 */
watch(open, async (v) => {
  if (!v) return
  await nextTick()
  scrollActive(hourListEl.value)
  scrollActive(minuteListEl.value)
})
function scrollActive(listEl: HTMLElement | null | undefined): void {
  if (!listEl) return
  const active = listEl.querySelector<HTMLElement>('.tp-item[data-active="y"]')
  if (!active || typeof listEl.scrollTo !== 'function') return
  const lr = listEl.getBoundingClientRect()
  const ar = active.getBoundingClientRect()
  const offset = ar.top - lr.top - (lr.height - ar.height) / 2
  listEl.scrollTo({ top: Math.max(0, listEl.scrollTop + offset) })
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
.tp {
  position: relative;
  width: 100%;
  min-width: 0;
}
.tp-trigger {
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
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.tp-trigger:hover,
.tp-trigger:focus-visible {
  outline: none;
  background: var(--surface-bg-hover);
  border-color: var(--color-primary);
}
.tp-trigger svg {
  color: var(--color-text-tertiary);
  flex: 0 0 auto;
}
.tp-value {
  flex: 1;
  text-align: left;
  letter-spacing: 0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tp-value.is-empty {
  color: var(--color-text-tertiary);
}

.tp-panel {
  position: fixed;
  z-index: 10050;
  display: flex;
  flex-direction: column;
  padding: 8px 6px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--glass-bg-active) 96%, var(--color-bg-base));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}
.tp-cols {
  display: flex;
  align-items: stretch;
  gap: 4px;
}
.tp-col {
  width: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.tp-col-label {
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--color-text-tertiary);
}
.tp-colon {
  align-self: center;
  padding-top: 14px;
  font-weight: var(--font-bold);
  font-size: 14px;
  color: var(--color-text-tertiary);
}
.tp-list {
  width: 100%;
  max-height: 168px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.tp-item {
  width: 100%;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}
.tp-item:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text-primary);
}
.tp-item.active {
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  color: var(--color-text-primary);
  font-weight: var(--font-bold);
}

.tp-foot {
  display: flex;
  justify-content: center;
  padding-top: 6px;
  margin-top: 4px;
  border-top: 1px solid var(--glass-border);
}
.tp-clear {
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 11px;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-out);
}
.tp-clear:hover {
  color: var(--color-primary);
}

.tp-fade-enter-active,
.tp-fade-leave-active {
  transition:
    opacity 0.14s var(--ease-out),
    transform 0.14s var(--ease-out);
}
.tp-fade-enter-from,
.tp-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
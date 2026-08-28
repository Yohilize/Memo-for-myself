<script setup lang="ts">
/**
 * IdeaPreviewWindow — 灵感「预览窗口」。
 *
 * 用途：点击灵感卡片 → 弹出一个小型浮动预览窗，快速查看灵感内容（仅查看，不进入编辑）。
 * 交互（本阶段仅此三种）：点击灵感卡片打开 → 拖动标题栏移动窗口 → 点击关闭。
 * 不做：重新设计编辑界面、缩放、最大化、复杂动画、 backdrop 遮罩（保持轻量的浮动小窗）。
 *
 * 视觉：完全复用现有 Design Token（玻璃 / 阴影 / 圆角 / 字体 / 语义色），与灵感列表同套质感。
 * 数据：props.idea 直接引用 Store 里的真实 IdeaEvent（eventsByType.idea 的元素），不做拷贝。
 *      可见性由 idea 是否为 null 推导；关闭仅把父级的 preview 置空，不改数据、不触发保存。
 */
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { IdeaEvent } from '@/types/event'

const props = defineProps<{
  /** 要预览的灵感；为 null 时关闭。引用 Store 中的真实对象 */
  idea: IdeaEvent | null
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'edit'): void }>()

const visible = computed(() => !!props.idea)

// —— 固定小窗宽度（约 0.8 倍于上一版）—— //
const WIDTH = 576
const MARGIN = 12

interface Pos {
  x: number
  y: number
}

const pos = ref<Pos>({ x: 0, y: 0 })
const windowEl = ref<HTMLElement | null>(null)

let dragStart: { sx: number; sy: number; ox: number; oy: number } | null = null

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

// —— 每次打开时把窗口水平、垂直居中 —— //
function centerOn(el: HTMLElement): void {
  const winW = window.innerWidth
  const winH = window.innerHeight
  pos.value.x = clamp((winW - el.offsetWidth) / 2, MARGIN, Math.max(MARGIN, winW - el.offsetWidth - MARGIN))
  pos.value.y = clamp((winH - el.offsetHeight) / 2, MARGIN, Math.max(MARGIN, winH - el.offsetHeight - MARGIN))
}

// 可见时（v-if 渲染完成后）重新居中，保证初始出现在页面正中央
watch(visible, (v) => {
  if (v) {
    nextTick(() => {
      const el = windowEl.value
      if (el) centerOn(el)
    })
  }
})

function onDragStart(e: PointerEvent): void {
  const el = windowEl.value
  if (!el || e.button !== 0) return
  e.preventDefault()
  dragStart = {
    sx: e.clientX,
    sy: e.clientY,
    ox: pos.value.x,
    oy: pos.value.y,
  }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragEnd)
}

function onDragMove(e: PointerEvent): void {
  if (!dragStart) return
  const el = windowEl.value
  const maxX = Math.max(MARGIN, window.innerWidth - (el ? el.offsetWidth : WIDTH) - MARGIN)
  const maxY = Math.max(MARGIN, window.innerHeight - (el ? el.offsetHeight : 0) - MARGIN)
  pos.value.x = clamp(dragStart.ox + e.clientX - dragStart.sx, MARGIN, maxX)
  pos.value.y = clamp(dragStart.oy + e.clientY - dragStart.sy, MARGIN, maxY)
}

function onDragEnd(): void {
  dragStart = null
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
}

onUnmounted(() => {
  if (dragStart) onDragEnd()
})

// —— 展示格式化（与灵感列表同款）—— //
function formatCreatedAt(iso: string): string {
  const d = dayjs(iso)
  const now = dayjs()
  if (d.isSame(now, 'day')) return `今天 ${d.format('HH:mm')}`
  if (d.isSame(now.subtract(1, 'day'), 'day')) return `昨天 ${d.format('HH:mm')}`
  if (d.isSame(now, 'year')) return d.format('M月D日 HH:mm')
  return d.format('YYYY年M月D日')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ipw-fade">
      <div
        v-if="visible"
        ref="windowEl"
        class="ipw-window"
        :style="{ left: pos.x + 'px', top: pos.y + 'px', width: WIDTH + 'px' }"
        role="dialog"
        aria-label="灵感预览"
      >
        <!-- 标题栏：拖动手柄，拖动时保持窗口位置自由移动 -->
        <header class="ipw-titlebar" @pointerdown="onDragStart">
          <span class="ipw-grip" aria-hidden="true">⠿</span>
          <span class="ipw-title">{{ idea?.title }}</span>
          <div class="ipw-titlebar-actions" @pointerdown.stop>
            <button class="ipw-close" title="关闭" @click="emit('close')" aria-label="关闭预览">×</button>
          </div>
        </header>

        <!-- 内容区：主要信息 + 完整灵感内容 -->
        <div class="ipw-body">
          <div class="ipw-meta">
            <span v-if="idea?.archived" class="ipw-archived">已归档</span>
            <span class="ipw-created">🕒 {{ idea ? formatCreatedAt(idea.created_at) : '' }}</span>
          </div>

          <p v-if="idea?.content" class="ipw-content">{{ idea.content }}</p>
          <p v-else-if="idea?.notes" class="ipw-content muted">{{ idea.notes }}</p>
          <p v-else class="ipw-content muted">（暂无内容）</p>

          <div v-if="idea?.tags && idea.tags.length" class="ipw-tags">
            <span v-for="tag in idea.tags" :key="tag" class="ipw-tag">#{{ tag }}</span>
          </div>
        </div>

        <!-- 底部操作区：编辑按钮（点击关闭预览，交由父级打开全局 EventForm 编辑窗口）-->
        <footer class="ipw-footer">
          <button class="ipw-edit" @click="emit('edit')">
            ✏️ 编辑
          </button>
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 浮动小窗：固定定位，视觉完全复用 Design Token，保持灵感页同套玻璃质感 */
.ipw-window {
  position: fixed;
  z-index: var(--z-dropdown);
  max-width: calc(100vw - 24px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  border-radius: calc(var(--glass-radius) - 4px);
  color: var(--color-text-primary);
}

/* —— 标题栏（拖动手柄）：仅压缩纵向高度，左右内边距保持以维持整体宽度 —— */
.ipw-titlebar {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 13px 19px;
  border-bottom: 1px solid var(--divider-color);
  cursor: grab;
  user-select: none;
  touch-action: none;
  background: color-mix(in srgb, var(--glass-bg-active) 55%, transparent);
}
.ipw-titlebar:active {
  cursor: grabbing;
}
.ipw-grip {
  font-size: 21px;
  line-height: 1;
  color: var(--color-text-tertiary);
  letter-spacing: 1px;
}
.ipw-title {
  flex: 1;
  min-width: 0;
  font-size: 21px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ipw-titlebar-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.ipw-close {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 10px;
  /* 用 flex 让 × 在水平、垂直方向都精确居中，避免字形基线产生的视觉偏移 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 23px;
  line-height: 1;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.ipw-close:hover {
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
  color: var(--color-danger-light);
}

/* —— 内容区 —— */
.ipw-body {
  padding: 22px 26px;
  max-height: 60vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ipw-meta {
  display: flex;
  align-items: center;
  gap: 13px;
  font-size: 18px;
  color: var(--color-text-tertiary);
}
.ipw-archived {
  padding: 2px 13px;
  border-radius: 999px;
  background: var(--color-accent-2-soft);
  color: var(--color-text-secondary);
  font-size: 16px;
  font-weight: var(--font-medium);
}
.ipw-content {
  margin: 0;
  font-size: 21px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}
.ipw-content.muted {
  font-style: italic;
  color: var(--color-text-tertiary);
}
.ipw-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 3px;
}
.ipw-tag {
  display: inline-block;
  padding: 3px 14px;
  font-size: 16px;
  border-radius: 999px;
  background: var(--color-accent-2-soft);
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
}

/* —— 底部操作区：仅压缩纵向高度，左右内边距保持以维持整体宽度 —— */
.ipw-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 11px 19px 13px;
  border-top: 1px solid var(--divider-color);
  background: color-mix(in srgb, var(--glass-bg-active) 40%, transparent);
}
.ipw-edit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 45%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.ipw-edit:hover {
  background: color-mix(in srgb, var(--color-primary) 24%, transparent);
  color: var(--color-text-primary);
}

/* —— 进入 / 退出动画：轻量淡入 + 微上浮，不做复杂动效 —— */
.ipw-fade-enter-active,
.ipw-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.ipw-fade-enter-from,
.ipw-fade-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}
</style>
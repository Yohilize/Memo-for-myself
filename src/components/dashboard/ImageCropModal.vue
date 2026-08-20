<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'

/**
 * 图片组件调整弹窗。
 *  - 预览框（视口）尺寸固定，宽高比 = Dashboard 中图片组件实际显示比例（targetRatio）。
 *  - 交互：拖动图片调整位置；拖动缩放滑块调整图片在预览框内的显示大小（50%~200%，默认 100%）。
 *  - 100% = 让图片铺满预览框；低于 100% 图片小于框（四周留透明）；高于 100% 为放大裁切。
 *  - 确认后按当前预览内容导出，得到与展示区一致的最终图片。
 */
const props = defineProps<{
  visible: boolean
  /** 上传的原始图片 DataURL */
  imageDataUrl: string
  /** 目标宽高比（宽 / 高），与图片组件实际显示比例一致 */
  targetRatio: number
}>()

const emit = defineEmits<{
  (event: 'cancel'): void
  (event: 'confirm', dataUrl: string): void
}>()

const viewportRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)

const viewportW = ref(0)
const viewportH = ref(0)

const naturalW = ref(0)
const naturalH = ref(0)
const ratio = computed(() => props.targetRatio > 0 ? props.targetRatio : 1)

// 平移偏移（显示像素，相对预览框中心）与缩放百分比
const offsetX = ref(0)
const offsetY = ref(0)
const SCALE_MIN = 50
const SCALE_MAX = 200
const scalePct = ref(100)

/** 滑块百分转放大系数：100% = 铺满预览框 */
function scaleFactor(): number {
  return scalePct.value / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** 依据目标比例 + 窗口尺寸约束裁剪框的显示大小（保证高度不超过弹窗可视区） */
function layoutViewport(): void {
  const maxW = Math.min(window.innerWidth - 48, 460)
  const maxH = Math.min(window.innerHeight * 0.46, 430)
  let w = maxW
  let h = w / ratio.value
  if (h > maxH) {
    h = maxH
    w = h * ratio.value
  }
  viewportW.value = w
  viewportH.value = h
}

function baseScale(): number {
  if (!naturalW.value || !naturalH.value) return 1
  return Math.max(
    viewportW.value / naturalW.value,
    viewportH.value / naturalH.value,
  )
}

/** 当前图片的显示尺寸与左上角（预览框坐标系） */
function geometry(): { dw: number; dh: number; left: number; top: number } {
  const z = baseScale() * scaleFactor()
  const dw = naturalW.value * z
  const dh = naturalH.value * z
  const left = viewportW.value / 2 + offsetX.value - dw / 2
  const top = viewportH.value / 2 + offsetY.value - dh / 2
  return { dw, dh, left, top }
}

/**
 * 约束平移偏移：
 *  - 图片大于预览框 → 保持图片始终盖住预览框；
 *  - 图片小于预览框 → 保持图片始终完整在框内（四周留透明）。
 *  两种情况统一为 slack = |图片尺寸 − 框尺寸| / 2。
 */
function clampOffsets(): void {
  const z = baseScale() * scaleFactor()
  const dw = naturalW.value * z
  const dh = naturalH.value * z
  const slackX = Math.abs(dw - viewportW.value) / 2
  const slackY = Math.abs(dh - viewportH.value) / 2
  offsetX.value = clamp(offsetX.value, -slackX, slackX)
  offsetY.value = clamp(offsetY.value, -slackY, slackY)
}

const imgStyle = computed(() => {
  const { dw, dh, left, top } = geometry()
  return {
    width: `${dw}px`,
    height: `${dh}px`,
    transform: `translate(${left}px, ${top}px)`,
  }
})

function reset(): void {
  scalePct.value = 100
  offsetX.value = 0
  offsetY.value = 0
}

// —— 加载原始图，取出自然尺寸 —— //
function loadSource(): void {
  if (!props.imageDataUrl) return
  const img = new Image()
  img.onload = () => {
    naturalW.value = img.naturalWidth
    naturalH.value = img.naturalHeight
    reset()
    layoutViewport()
  }
  img.src = props.imageDataUrl
}

watch(
  () => [props.visible, props.imageDataUrl] as const,
  ([visible]) => {
    if (visible) {
      layoutViewport()
      loadSource()
    }
  },
  { immediate: true },
)

// —— 交互：拖动平移 + 滚轮缩放 —— //
let dragging = false
let lastX = 0
let lastY = 0

function onPointerDown(e: PointerEvent): void {
  dragging = true
  lastX = e.clientX
  lastY = e.clientY
  viewportRef.value?.setPointerCapture(e.pointerId)
}
function onPointerMove(e: PointerEvent): void {
  if (!dragging) return
  offsetX.value += e.clientX - lastX
  offsetY.value += e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
  clampOffsets()
}
function onPointerUp(e: PointerEvent): void {
  dragging = false
  viewportRef.value?.releasePointerCapture(e.pointerId)
}

function onWheel(e: WheelEvent): void {
  const step = e.deltaY < 0 ? 5 : -5
  scalePct.value = clamp(scalePct.value + step, SCALE_MIN, SCALE_MAX)
  clampOffsets()
}

/** 拖拽滑块：实时缩放（数量已由 input 保证在 50~200 内） */
function onScaleInput(e: Event): void {
  const value = Number((e.target as HTMLInputElement).value)
  if (Number.isFinite(value)) {
    scalePct.value = clamp(value, SCALE_MIN, SCALE_MAX)
    clampOffsets()
  }
}

/** 把当前预览框内容导出为按比例的透明度 DataURL */
function confirmCrop(): void {
  const img = imgRef.value
  if (!img || !naturalW.value || !naturalH.value) return

  const vw = viewportW.value
  const vh = viewportH.value
  const { dw, dh, left, top } = geometry()
  const z = baseScale() * scaleFactor()

  // 可见区域 = 图片与预览框的交集
  const visibleLeft = Math.max(0, left)
  const visibleTop = Math.max(0, top)
  const visibleRight = Math.min(vw, left + dw)
  const visibleBottom = Math.min(vh, top + dh)
  const sx = (visibleLeft - left) / z
  const sy = (visibleTop - top) / z
  const sw = (visibleRight - visibleLeft) / z
  const sh = (visibleBottom - visibleTop) / z

  // 导出清晰度：长边目标 ~1400px，适当放大原始视口比例
  const k = clamp(1400 / Math.max(vw, vh, 1), 1, 4)
  const outW = Math.max(1, Math.round(vw * k))
  const outH = Math.max(1, Math.round(vh * k))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  // 让出透明度：低于 100% 缩放时四周留透明，与组件的圆角纯图块融为一体
  ctx.clearRect(0, 0, outW, outH)
  ctx.drawImage(
    img,
    sx,
    sy,
    sw,
    sh,
    visibleLeft * k,
    visibleTop * k,
    (visibleRight - visibleLeft) * k,
    (visibleBottom - visibleTop) * k,
  )

  emit('confirm', canvas.toDataURL('image/png'))
  reset()
}

function cancel(): void {
  reset()
  emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="crop-fade">
      <div
        v-if="visible"
        class="crop-mask"
        role="presentation"
        @click.self="cancel"
      >
        <section
          class="crop-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="裁剪图片"
        >
          <header class="crop-head">
            <div>
              <h2 class="crop-title">调整图片</h2>
              <p class="crop-sub">拖动图片调整位置 · 拖动滑块调整显示大小</p>
            </div>
            <button
              class="crop-close"
              type="button"
              aria-label="关闭"
              @click="cancel"
            >
              ×
            </button>
          </header>

          <div class="crop-body">
            <div
              ref="viewportRef"
              class="crop-viewport"
              :style="{ width: `${viewportW}px`, height: `${viewportH}px` }"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @pointercancel="onPointerUp"
              @wheel.prevent="onWheel"
            >
              <img
                ref="imgRef"
                class="crop-img"
                :src="imageDataUrl"
                alt="待裁剪的图片"
                draggable="false"
                :style="imgStyle"
              />
              <div class="crop-hint">拖动图片</div>
            </div>

            <div class="crop-zoom">
              <span class="crop-zoom-label">缩放</span>
              <input
                class="crop-zoom-range"
                type="range"
                min="50"
                max="200"
                step="1"
                :value="scalePct"
                aria-label="图片显示大小"
                @input="onScaleInput"
              />
              <span class="crop-zoom-scale">{{ scalePct }}%</span>
              <button
                class="crop-reset"
                type="button"
                title="重置到 100% 并居中"
                @click="reset"
              >
                重置
              </button>
            </div>
          </div>

          <footer class="crop-actions">
            <BaseButton variant="ghost" size="md" @click="cancel">取消</BaseButton>
            <BaseButton variant="primary" size="md" @click="confirmCrop">确认裁剪</BaseButton>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.crop-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: color-mix(in srgb, var(--color-primary) 18%, rgba(255, 255, 255, 0.30));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.crop-dialog {
  width: min(100%, 520px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  background: var(--glass-bg);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}
.crop-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.crop-title {
  margin: 0;
  font-size: 14px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.crop-sub {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.crop-close {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.crop-close:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text-primary);
}
.crop-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.crop-viewport {
  position: relative;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  background:
    repeating-conic-gradient(
      color-mix(in srgb, var(--color-accent-2) 12%, transparent) 0% 25%,
      transparent 0% 50%
    ) 50% / 18px 18px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
}
.crop-viewport:active {
  cursor: grabbing;
}
.crop-img {
  position: absolute;
  left: 0;
  top: 0;
  max-width: none;
  max-height: none;
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
}
.crop-hint {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 10px;
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--glass-bg) 86%, transparent);
  backdrop-filter: blur(4px);
}
.crop-zoom {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px;
}
.crop-zoom-label {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--color-text-secondary);
}
.crop-zoom-range {
  flex: 1;
  min-width: 0;
  height: 4px;
  accent-color: var(--color-primary);
  cursor: pointer;
}
.crop-zoom-range::-moz-range-thumb {
  cursor: grab;
}
.crop-zoom-range::-moz-range-thumb:active {
  cursor: grabbing;
}
.crop-zoom-range::-webkit-slider-thumb {
  cursor: grab;
}
.crop-zoom-range::-webkit-slider-thumb:active {
  cursor: grabbing;
}
.crop-zoom-scale {
  flex: 0 0 42px;
  text-align: right;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
}
.crop-reset {
  flex: 0 0 auto;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-primary);
  font-size: 10px;
  cursor: pointer;
}
.crop-reset:hover {
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
}
.crop-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.crop-fade-enter-active,
.crop-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}
.crop-fade-enter-from,
.crop-fade-leave-to {
  opacity: 0;
}
</style>
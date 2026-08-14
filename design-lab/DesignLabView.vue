<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseSlider from '@/components/base/BaseSlider.vue'
import {
  state,
  PRESETS,
  presetSnapshot,
  resetTokens,
  applyPreset,
  restoreBasePreset,
  setWallpaper,
  getWallpaper,
  exportTokensAsCss,
  resetWallpaperTransform,
} from './useTokenControls'

// ========== Tab ==========
type TabKey = 'layout' | 'background' | 'glass' | 'colors' | 'components'
const activeTab = ref<TabKey>('layout')

const tabs: { key: TabKey; label: string }[] = [
  { key: 'layout', label: '布局' },
  { key: 'background', label: '背景' },
  { key: 'glass', label: '玻璃' },
  { key: 'colors', label: '配色' },
  { key: 'components', label: '组件预览' },
]

// ========== 组件预览 ==========
type ComponentKey = 'dashboard' | 'button' | 'badge' | 'input' | 'card'
const previewComponent = ref<ComponentKey>('dashboard')

// ========== 壁纸 ==========
const wallpaperUrl = computed(() => getWallpaper())

function onWallpaperUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = () => {
      setWallpaper(reader.result as string)
      resetWallpaperTransform()
    }
    reader.readAsDataURL(file)
  }
}
function clearWallpaper() {
  setWallpaper('')
  resetWallpaperTransform()
}

// ========== 颜色：预设 + RGB 微调 ==========
const customizing = ref(false)
const activePreset = computed(() => {
  for (const p of PRESETS) {
    if (
      state.primaryColor.toLowerCase() === p.p.toLowerCase() &&
      state.accentColor.toLowerCase() === p.a.toLowerCase() &&
      state.accent2Color.toLowerCase() === p.a2.toLowerCase()
    ) return p.name
  }
  return ''
})

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}
function rgbToHex(r: number, g: number, b: number) {
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
function mkChannel(prop: 'primaryColor' | 'accentColor' | 'accent2Color', ch: 'r' | 'g' | 'b') {
  return computed({
    get() { return hexToRgb(state[prop])[ch] },
    set(v: number) {
      const { r, g, b } = hexToRgb(state[prop])
      if (ch === 'r') state[prop] = rgbToHex(v, g, b)
      if (ch === 'g') state[prop] = rgbToHex(r, v, b)
      if (ch === 'b') state[prop] = rgbToHex(r, g, v)
    },
  })
}
const pR = mkChannel('primaryColor', 'r')
const pG = mkChannel('primaryColor', 'g')
const pB = mkChannel('primaryColor', 'b')
const aR = mkChannel('accentColor', 'r')
const aG = mkChannel('accentColor', 'g')
const aB = mkChannel('accentColor', 'b')
const a2R = mkChannel('accent2Color', 'r')
const a2G = mkChannel('accent2Color', 'g')
const a2B = mkChannel('accent2Color', 'b')

function startCustomize(presetName: string) {
  applyPreset(presetName)
  customizing.value = true
}

function onExport() {
  const css = exportTokensAsCss()
  navigator.clipboard.writeText(css)
  alert('CSS 变量已复制到剪贴板，粘贴到 tokens.css 即可固化')
}

const typeLabels: Record<string, string> = {
  calendar: '日历事件',
  deadline: 'Deadline',
  duration: '时间块',
  idea: '灵感',
}
const typeColors: Record<string, string> = {
  calendar: 'var(--color-event-calendar)',
  deadline: 'var(--color-event-deadline)',
  duration: 'var(--color-event-duration)',
  idea: 'var(--color-event-idea)',
}

// ======================== 预览区：背景图直接拖拽 & 缩放 ========================
const stageRef = ref<HTMLElement | null>(null)
const isDraggingBg = ref(false)
let dragStartX = 0
let dragStartY = 0
let dragStartOffX = 0
let dragStartOffY = 0

function onStageMouseDown(ev: MouseEvent) {
  if (!wallpaperUrl.value) return
  // 仅在主按钮（左键）且目标在预览背景区时开始拖拽
  if (ev.button !== 0) return
  isDraggingBg.value = true
  dragStartX = ev.clientX
  dragStartY = ev.clientY
  dragStartOffX = state.bgOffsetX
  dragStartOffY = state.bgOffsetY
  window.addEventListener('mousemove', onStageMouseMove)
  window.addEventListener('mouseup', onStageMouseUp)
}
function onStageMouseMove(ev: MouseEvent) {
  if (!isDraggingBg.value) return
  const dx = ev.clientX - dragStartX
  const dy = ev.clientY - dragStartY
  state.bgOffsetX = dragStartOffX + dx
  state.bgOffsetY = dragStartOffY + dy
}
function onStageMouseUp() {
  isDraggingBg.value = false
  window.removeEventListener('mousemove', onStageMouseMove)
  window.removeEventListener('mouseup', onStageMouseUp)
}
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onStageMouseMove)
  window.removeEventListener('mouseup', onStageMouseUp)
})

function onStageWheel(ev: WheelEvent) {
  if (!wallpaperUrl.value) return
  // 只有按住 Ctrl 才触发缩放（避免滚动时误操作）
  // 但用户需要便捷的缩放，这里直接接受 wheel 作为缩放，但不阻止页面滚动除非 alt/ctrl。
  if (!ev.ctrlKey && !ev.altKey) return
  ev.preventDefault()
  const delta = ev.deltaY > 0 ? -0.04 : 0.04
  const next = Math.max(0.5, Math.min(3.5, state.bgScale + delta))
  state.bgScale = Number(next.toFixed(3))
}
</script>

<template>
  <div class="design-lab">
    <!-- ============ 顶部：轻量、柔和、无紫色渐变标题 ============ -->
    <header class="lab-header">
      <div class="header-left">
        <div class="lab-title-row">
          <h1 class="lab-title">Design Lab</h1>
          <span class="lab-tag">开发调试工具</span>
        </div>
        <p class="lab-subtitle">
          在这里调整参数 → 主预览实时变化 → 最后导出并固化为 MYMEMO 设计基准
        </p>
      </div>
      <div class="lab-actions">
        <nav class="tab-switch">
          <button v-for="t in tabs" :key="t.key" :class="{ active: activeTab === t.key }"
            @click="activeTab = t.key">
            {{ t.label }}
          </button>
        </nav>
        <div class="header-btns">
          <BaseButton variant="ghost" size="sm" @click="resetTokens">默认值</BaseButton>
          <BaseButton variant="primary" size="sm" @click="onExport">导出 CSS</BaseButton>
        </div>
      </div>
    </header>

    <div class="lab-body">
      <!-- ===================== 左：预览区 ===================== -->
      <section class="preview-section">
        <div class="preview-toolbar">
          <div class="preview-label">主预览（所见即所得）</div>
          <div class="preview-switcher">
            <button v-for="k in (['dashboard','button','badge','input','card'] as const)"
              :key="k" :class="{ active: previewComponent === k }"
              @click="previewComponent = k">
              {{
                { dashboard:'综合', button:'按钮', badge:'徽章', input:'输入框', card:'卡片' }[k]
              }}
            </button>
          </div>
        </div>

        <!-- 预览舞台：背景层可直接拖拽（有壁纸时） -->
        <div ref="stageRef" class="preview-stage"
          :class="{ 'can-drag': !!wallpaperUrl && !isDraggingBg, 'dragging': isDraggingBg }"
          @mousedown="onStageMouseDown"
          @wheel.passive="onStageWheel">

          <!-- 预览背景：完全镜像 BackgroundLayer.vue 的 transform(offset/scale) 模型
               确保拖拽/缩放结果就是真实 MYMEMO 的结果 -->
          <div class="preview-bg">
            <div class="preview-bg-orb o1"></div>
            <div class="preview-bg-orb o2"></div>
            <div class="preview-bg-orb o3"></div>

            <!-- 与真实 BackgroundLayer 一致：真实 <img> + min-cover（图片本身完整保留像素不被提前裁切）
                 translate(offsetX/offsetY) 平移时会真正暴露原先在容器外的图像内容，
                 这样"拖动调整位置 / 缩放"的操作对用户才是有意义的。 -->
            <div class="preview-bg-image-wrap">
              <img v-if="wallpaperUrl" class="preview-bg-image"
                :src="wallpaperUrl" alt="" draggable="false" />
            </div>
            <div class="preview-bg-mask"></div>
          </div>

          <!-- 拖拽提示（仅在有壁纸时显示很淡的提示） -->
          <div v-if="wallpaperUrl && !isDraggingBg" class="drag-hint">
            按住拖动 · Ctrl / Alt + 滚轮缩放
          </div>

          <!-- 中央悬浮玻璃面板（宽 = --app-width） -->
          <div class="preview-app">
            <div class="preview-app-inner" :style="{ width: state.appWidth + '%' }">
              <!-- 左侧栏 -->
              <aside class="preview-sidebar">
                <img class="preview-logo" src="/favicon.png" alt="" draggable="false" />
                <div class="preview-nav active">📅</div>
                <div class="preview-nav">⏰</div>
                <div class="preview-nav">💡</div>
                <div class="preview-nav footer">⚙</div>
              </aside>

              <!-- 内容 -->
              <main class="preview-content">
                <!-- Dashboard -->
                <template v-if="previewComponent === 'dashboard'">
                  <div class="pv-dashboard">
                    <div class="pv-date">2026年8月12日 · 星期三</div>
                    <div class="pv-greet">下午好，今天有 3 件待办。</div>

                    <div class="pv-row">
                      <BaseCard padding="md" class="pv-chip">
                        <div class="chip-title">待办</div>
                        <div class="chip-val">5</div>
                      </BaseCard>
                      <BaseCard padding="md" class="pv-chip">
                        <div class="chip-title">今日完成</div>
                        <div class="chip-val">2</div>
                      </BaseCard>
                      <BaseCard padding="md" class="pv-chip">
                        <div class="chip-title">灵感</div>
                        <div class="chip-val">9</div>
                      </BaseCard>
                    </div>

                    <div class="pv-section-title">今日事件</div>
                    <div class="pv-events">
                      <div v-for="(c, idx) in typeLabels" :key="idx" class="pv-event"
                        :style="{ '--c': typeColors[c] }">
                        <span class="dot"></span>
                        <div>
                          <div class="et">
                            {{
                              {calendar:'晨会', deadline:'项目方案截止',
                                duration:'深度工作 2h', idea:'做一个时间看板'}[c] ?? '事件'
                            }}
                          </div>
                          <div class="em">{{ c }} · {{{calendar:'09:00', deadline:'18:00',
                            duration:'10:00-12:00', idea:'灵感'}[c] ?? '' }}</div>
                        </div>
                        <BaseBadge :color="typeColors[c]">{{ typeLabels[c] }}</BaseBadge>
                      </div>
                    </div>

                    <div class="pv-section-title">组件</div>
                    <div class="pv-components">
                      <BaseButton variant="primary">主按钮</BaseButton>
                      <BaseButton variant="secondary">次按钮</BaseButton>
                      <BaseButton variant="ghost">文字按钮</BaseButton>
                      <BaseInput placeholder="输入内容..." style="min-width: 180px" />
                    </div>
                  </div>
                </template>

                <!-- Button -->
                <template v-else-if="previewComponent === 'button'">
                  <div class="pv-solo">
                    <div class="pv-section-title">变体</div>
                    <div class="pv-row mb-4">
                      <BaseButton variant="primary">Primary</BaseButton>
                      <BaseButton variant="secondary">Secondary</BaseButton>
                      <BaseButton variant="ghost">Ghost</BaseButton>
                      <BaseButton variant="danger">Danger</BaseButton>
                    </div>
                    <div class="pv-section-title">尺寸</div>
                    <div class="pv-row mb-4">
                      <BaseButton variant="primary" size="sm">Small</BaseButton>
                      <BaseButton variant="primary" size="md">Medium</BaseButton>
                      <BaseButton variant="primary" size="lg">Large</BaseButton>
                    </div>
                    <div class="pv-section-title">状态</div>
                    <div class="pv-row">
                      <BaseButton variant="primary">正常</BaseButton>
                      <BaseButton variant="primary" disabled>Disabled</BaseButton>
                    </div>
                  </div>
                </template>

                <!-- Badge -->
                <template v-else-if="previewComponent === 'badge'">
                  <div class="pv-solo">
                    <div class="pv-section-title">软色调（soft）</div>
                    <div class="pv-row mb-4">
                      <BaseBadge color="var(--color-event-calendar)">日历</BaseBadge>
                      <BaseBadge color="var(--color-event-deadline)">截止</BaseBadge>
                      <BaseBadge color="var(--color-event-duration)">时间块</BaseBadge>
                      <BaseBadge color="var(--color-event-idea)">灵感</BaseBadge>
                      <BaseBadge color="var(--color-danger)">逾期</BaseBadge>
                      <BaseBadge color="var(--color-success)">完成</BaseBadge>
                      <BaseBadge color="var(--color-primary)">Primary</BaseBadge>
                      <BaseBadge color="var(--color-accent)">Accent</BaseBadge>
                    </div>
                    <div class="pv-section-title">变体</div>
                    <div class="pv-row mb-4">
                      <BaseBadge variant="soft" color="var(--color-primary)">Soft</BaseBadge>
                      <BaseBadge variant="solid" color="var(--color-primary)">Solid</BaseBadge>
                      <BaseBadge variant="outline" color="var(--color-primary)">Outline</BaseBadge>
                    </div>
                  </div>
                </template>

                <!-- Input -->
                <template v-else-if="previewComponent === 'input'">
                  <div class="pv-solo">
                    <div class="pv-section-title">输入框</div>
                    <div class="pv-col gap-3">
                      <BaseInput placeholder="基础输入框..." />
                      <BaseInput value="已有内容的输入框" />
                      <div class="pv-row">
                        <BaseInput placeholder="搜索..." />
                        <BaseButton variant="primary">搜索</BaseButton>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Card -->
                <template v-else-if="previewComponent === 'card'">
                  <div class="pv-solo">
                    <div class="pv-section-title">卡片 · 内边距</div>
                    <div class="pv-col gap-3">
                      <BaseCard padding="sm">
                        <div class="c-title">sm padding</div>
                        <div class="c-desc">小内边距，适用于紧凑嵌套</div>
                      </BaseCard>
                      <BaseCard padding="md">
                        <div class="c-title">md padding</div>
                        <div class="c-desc">中内边距，常用面板默认值</div>
                        <BaseCard padding="sm" class="mt-3 nested">
                          <div class="c-desc">嵌套卡片 —— 次级表面</div>
                        </BaseCard>
                      </BaseCard>
                      <BaseCard padding="lg">
                        <div class="c-title">lg padding</div>
                        <div class="c-desc">大内边距，适用于主卡片和页面区块</div>
                      </BaseCard>
                    </div>
                  </div>
                </template>
              </main>
            </div>
          </div>
        </div>
      </section>

      <!-- ===================== 右：控制面板 ===================== -->
      <aside class="control-section">
        <div class="control-panel">

          <!-- ===== 布局 ===== -->
          <template v-if="activeTab === 'layout'">
            <BaseCard padding="md">
              <h3 class="control-group-title">主面板宽度</h3>
              <p class="control-desc">当前：<b>{{ state.appWidth }}%</b>（占预览区宽度的比例）</p>
              <BaseSlider v-model="state.appWidth" :min="40" :max="100" :step="1" unit="%"
                label="中央面板占屏宽比例" />
              <div class="preset-row mt-3">
                <button v-for="v in [50,60,66,75,80,90]" :key="v" class="preset-btn"
                  @click="state.appWidth = v">
                  {{ v }}%
                </button>
              </div>
              <p class="control-hint mt-3">
                拖动滑块，实时观察中央面板与两侧留白的比例变化。
              </p>
            </BaseCard>
          </template>

          <!-- ===== 背景 ===== -->
          <template v-else-if="activeTab === 'background'">
            <BaseCard padding="md">
              <h3 class="control-group-title">壁纸</h3>
              <div class="wallpaper-actions">
                <label class="upload-btn">
                  <input type="file" accept="image/*" hidden @change="onWallpaperUpload" />
                  上传图片
                </label>
                <button class="clear-btn" @click="clearWallpaper">清除</button>
              </div>
              <p class="control-hint mt-3" v-if="wallpaperUrl">
                已上传。在左侧预览区 <b>按住拖动</b> 调整位置，
                <b>Ctrl / Alt + 滚轮</b> 缩放。
              </p>
            </BaseCard>

            <BaseCard padding="md">
              <h3 class="control-group-title">位置与缩放（连续）</h3>
              <div class="control-list">
                <div class="field-row">
                  <span class="field-label">位置 X</span>
                  <span class="field-value">{{ state.bgOffsetX }}px</span>
                </div>
                <BaseSlider v-model.number="state.bgOffsetX" :min="-600" :max="600" :step="1"
                  unit="px" label="横向偏移" />
                <div class="field-row">
                  <span class="field-label">位置 Y</span>
                  <span class="field-value">{{ state.bgOffsetY }}px</span>
                </div>
                <BaseSlider v-model.number="state.bgOffsetY" :min="-600" :max="600" :step="1"
                  unit="px" label="纵向偏移" />
                <div class="field-row">
                  <span class="field-label">图片缩放</span>
                  <span class="field-value">×{{ state.bgScale.toFixed(2) }}</span>
                </div>
                <BaseSlider v-model.number="state.bgScale" :min="0.5" :max="3.5" :step="0.01"
                  label="缩放比例（1.0 = cover）" />
                <button class="reset-btn" @click="resetWallpaperTransform">
                  重置位置 / 缩放
                </button>
              </div>
            </BaseCard>

            <BaseCard padding="md">
              <h3 class="control-group-title">透明 / 模糊 / 遮罩 / 光球</h3>
              <div class="control-list">
                <BaseSlider v-model="state.bgImageOpacity" :min="0" :max="1" :step="0.02"
                  label="图片透明度" />
                <BaseSlider v-model="state.bgImageBlur" :min="0" :max="20" :step="1" unit="px"
                  label="图片模糊" />
                <BaseSlider v-model="state.bgMaskOpacity" :min="0" :max="0.6" :step="0.02"
                  label="深色遮罩浓度" />
                <BaseSlider v-model="state.bgOrbOpacity" :min="0" :max="1" :step="0.05"
                  label="光球强度" />
              </div>
            </BaseCard>
          </template>

          <!-- ===== 玻璃 ===== -->
          <template v-else-if="activeTab === 'glass'">
            <BaseCard padding="md">
              <h3 class="control-group-title">玻璃参数</h3>
              <div class="control-list">
                <BaseSlider v-model="state.glassBlur" :min="0" :max="40" :step="1" unit="px"
                  label="模糊强度 (blur)" />
                <BaseSlider v-model="state.glassOpacity" :min="20" :max="95" :step="1" unit="%"
                  label="面板底色不透明度" />
                <BaseSlider v-model="state.glassRadius" :min="0" :max="40" :step="1" unit="px"
                  label="圆角 (radius)" />
              </div>
            </BaseCard>
          </template>

          <!-- ===== 配色 ===== -->
          <template v-else-if="activeTab === 'colors'">
            <BaseCard padding="md">
              <h3 class="control-group-title">预设主题（取自 icon_orgin.jpg）</h3>
              <div class="preset-list">
                <button v-for="preset in PRESETS" :key="preset.name" class="preset-btn-row"
                  :class="{ active: activePreset === preset.name && !customizing }"
                  @click="applyPreset(preset.name); customizing = false">
                  <span class="preset-dots">
                    <span :style="{ background: preset.p }"></span>
                    <span :style="{ background: preset.a }"></span>
                    <span :style="{ background: preset.a2 }"></span>
                  </span>
                  <span class="preset-name">{{ preset.name }}</span>
                  <span v-if="activePreset === preset.name && !customizing" class="customize-hint">
                    当前
                  </span>
                  <BaseButton v-else variant="ghost" size="sm"
                    @click.stop="startCustomize(preset.name)">
                    基于此主题自定义
                  </BaseButton>
                </button>
              </div>
            </BaseCard>

            <BaseCard padding="md">
              <h3 class="control-group-title">
                颜色微调
                <span class="base-preset">基于：{{ presetSnapshot.base }}</span>
              </h3>
              <div class="color-meta">
                <button class="restore-btn" @click="restoreBasePreset">恢复当前预设</button>
              </div>

              <div class="rgb-group">
                <div class="rgb-header">
                  <span class="rgb-swatch" :style="{ background: state.primaryColor }"></span>
                  <div>
                    <div class="rgb-title">Primary（暖棕发丝）</div>
                    <div class="rgb-value">
                      {{ state.primaryColor.toUpperCase() }}
                      · RGB({{ pR }}, {{ pG }}, {{ pB }})
                    </div>
                  </div>
                  <input type="color" v-model="state.primaryColor" class="color-picker" />
                </div>
                <BaseSlider v-model.number="pR" :min="0" :max="255" label="R" />
                <BaseSlider v-model.number="pG" :min="0" :max="255" label="G" />
                <BaseSlider v-model.number="pB" :min="0" :max="255" label="B" />
              </div>

              <div class="rgb-group">
                <div class="rgb-header">
                  <span class="rgb-swatch" :style="{ background: state.accentColor }"></span>
                  <div>
                    <div class="rgb-title">Accent（柔陶土红丝带）</div>
                    <div class="rgb-value">
                      {{ state.accentColor.toUpperCase() }}
                      · RGB({{ aR }}, {{ aG }}, {{ aB }})
                    </div>
                  </div>
                  <input type="color" v-model="state.accentColor" class="color-picker" />
                </div>
                <BaseSlider v-model.number="aR" :min="0" :max="255" label="R" />
                <BaseSlider v-model.number="aG" :min="0" :max="255" label="G" />
                <BaseSlider v-model.number="aB" :min="0" :max="255" label="B" />
              </div>

              <div class="rgb-group">
                <div class="rgb-header">
                  <span class="rgb-swatch" :style="{ background: state.accent2Color }"></span>
                  <div>
                    <div class="rgb-title">Accent 2（暖米灰棕）</div>
                    <div class="rgb-value">
                      {{ state.accent2Color.toUpperCase() }}
                      · RGB({{ a2R }}, {{ a2G }}, {{ a2B }})
                    </div>
                  </div>
                  <input type="color" v-model="state.accent2Color" class="color-picker" />
                </div>
                <BaseSlider v-model.number="a2R" :min="0" :max="255" label="R" />
                <BaseSlider v-model.number="a2G" :min="0" :max="255" label="G" />
                <BaseSlider v-model.number="a2B" :min="0" :max="255" label="B" />
              </div>
            </BaseCard>
          </template>

          <!-- ===== 组件预览信息 ===== -->
          <template v-else-if="activeTab === 'components'">
            <BaseCard padding="md">
              <h3 class="control-group-title">组件预览</h3>
              <p class="control-desc">
                在左侧预览区顶部的切换栏中选择组件，所有组件直接使用当前 Design Token
                渲染，调整参数会立即反馈。
              </p>
              <div class="component-toc">
                <button v-for="k in (['dashboard','button','badge','input','card'] as const)"
                  :key="k" class="toc-btn" @click="previewComponent = k">
                  {{ { dashboard:'仪表盘综合预览', button:'按钮', badge:'徽章',
                       input:'输入框', card:'卡片' }[k] }}
                </button>
              </div>
            </BaseCard>
          </template>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* =============================================================
   Design Lab 自身基调：
   - 不做紫色科技风
   - 参考 icon_orgin.jpg 的温暖留白 + 柔线条 + 米白纸质
   - 控件轻、间距足、呼吸感好
   ============================================================= */

.design-lab {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 28px 32px;
  overflow: hidden;
  /* 固定的调试工具底色：暖米白纸，不随 Token 变化，盖掉全局 BackgroundLayer（壁纸仅在预览区生效） */
  background: #f6eee4;
  color: #4a3f35;
}

/* ---------- 顶部 ---------- */
.lab-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  flex-shrink: 0;
  gap: 16px;
  flex-wrap: wrap;
}
.lab-title-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.lab-title {
  font-size: 24px;
  font-weight: 600;
  /* 固定暖棕标题，不再随 Token 颜色变化 */
  color: #4a3f35;
  letter-spacing: 0.2px;
}
.lab-tag {
  font-size: 11px;
  color: #a29482;
  padding: 3px 10px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(139, 111, 92, 0.14);
  border-radius: 999px;
}
.lab-subtitle {
  font-size: 12px;
  color: #a29482;
  margin-top: 6px;
  line-height: 1.6;
}
.lab-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.header-btns {
  display: flex;
  gap: 8px;
}
.tab-switch {
  display: flex;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(139, 111, 92, 0.14);
  border-radius: 12px;
  padding: 3px;
  flex-wrap: wrap;
}
.tab-switch button {
  padding: 6px 14px;
  font-size: 12px;
  border-radius: 9px;
  color: #a29482;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.tab-switch button:hover {
  color: #7a6b5c;
}
.tab-switch button.active {
  background: #fff;
  color: #4a3f35;
  box-shadow: 0 1px 4px rgba(139, 111, 92, 0.07);
}

/* ---------- 主体 ---------- */
.lab-body {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 20px;
  overflow: hidden;
  min-height: 0;
}

/* ==================== 预览区 ==================== */
.preview-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 8px;
}
.preview-label {
  font-size: 11px;
  letter-spacing: 1px;
  color: #a29482;
}
.preview-switcher {
  display: flex;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(139, 111, 92, 0.14);
  border-radius: 12px;
  padding: 2px;
  gap: 2px;
}
.preview-switcher button {
  padding: 4px 12px;
  font-size: 11px;
  border-radius: 9px;
  color: #a29482;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}
.preview-switcher button.active {
  background: #fff;
  color: #4a3f35;
  box-shadow: 0 1px 3px rgba(139, 111, 92, 0.06);
}

/* ---- 预览舞台：宽高跟随区域（调试工具的固定外框，不随 Token 变） ---- */
.preview-stage {
  flex: 1;
  border-radius: 18px;
  overflow: hidden;
  position: relative;
  min-height: 0;
  border: 1px solid rgba(139, 111, 92, 0.14);
  background: #fbf7f2;
}
.preview-stage.can-drag {
  cursor: grab;
}
.preview-stage.dragging {
  cursor: grabbing;
}

/* 预览背景层（严格镜像 BackgroundLayer 的 transform 模型） */
.preview-bg {
  position: absolute;
  inset: 0;
  background: var(--bg-gradient);
}
.preview-bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(var(--bg-orb-blur));
  opacity: var(--bg-orb-opacity);
}
.preview-bg-orb.o1 {
  width: 55%; aspect-ratio: 1;
  background: var(--bg-orb-color-1);
  top: -15%; left: -5%;
}
.preview-bg-orb.o2 {
  width: 48%; aspect-ratio: 1;
  background: var(--bg-orb-color-2);
  bottom: -10%; right: 0%;
}
.preview-bg-orb.o3 {
  width: 42%; aspect-ratio: 1;
  background: var(--bg-orb-color-3);
  top: 38%; left: 55%;
}

/* 背景图：真实 <img> + transform(offset/scale) 模型
   —— 图片自身不被提前裁切。用 min-width/min-height:100% 达到 cover 语义，
      溢出部分交由外层容器的 overflow: hidden 管理；
      这样 translate / scale 作用在完整的图片元素上，
      用户"拖动图片"时才能真正让原先在容器外的像素移动到视口内，
      而不是移动一块已经被裁过的画布。 */
.preview-bg-image-wrap {
  position: absolute;
  inset: 0;
  overflow: hidden;
  opacity: var(--bg-image-opacity);
  pointer-events: none;
}
.preview-bg-image {
  position: absolute;
  left: 50%;
  top: 50%;
  /* cover 的等价写法：让图片自身尺寸至少覆盖容器每一边 */
  min-width: 100%;
  min-height: 100%;
  width: auto;
  height: auto;
  /* 浏览器默认对 <img> 有 max-width:100% 限制，必须去掉，否则放大不了 */
  max-width: none;
  max-height: none;
  display: block;
  transform-origin: center center;
  transform:
    translate(-50%, -50%)
    translate(var(--bg-offset-x, 0px), var(--bg-offset-y, 0px))
    scale(var(--bg-scale, 1));
  filter: blur(var(--bg-image-blur, 0px));
  /* 阻止浏览器原生拖动选择框 / 拖 ghost */
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
}
.preview-bg-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, var(--bg-mask-opacity));
}

/* 拖拽小提示（调试工具提示层，固定样式，不随 Token 变） */
.drag-hint {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: #7a6b5c;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(139, 111, 92, 0.14);
  pointer-events: none;
  user-select: none;
  letter-spacing: 0.2px;
}

/* ---- 主悬浮玻璃面板 ---- */
.preview-app {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px;
  pointer-events: none;   /* 面板不拦截背景拖拽 */
}
.preview-app-inner {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  max-width: calc(100% - 72px);
  min-width: 360px;
  height: 84%;
  border-radius: var(--glass-radius);
  display: flex;
  overflow: hidden;
  transition:
    width var(--duration-normal) var(--ease-out),
    border-radius var(--duration-normal) var(--ease-out);
}
.preview-sidebar {
  width: 56px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border-right: 1px solid var(--surface-border);
  flex-shrink: 0;
}
.preview-logo {
  width: 36px; height: 36px;
  border-radius: 10px;
  object-fit: cover;
  object-position: center center;
  display: block;
  margin-bottom: 8px;
  user-select: none;
  -webkit-user-drag: none;
  background: #f6eadc;  /* 图片加载前的暖色垫底，和 favicon.png 的方形底近似 */
  flex-shrink: 0;
}
.preview-nav {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  opacity: 0.5;
}
.preview-nav.active {
  opacity: 1;
  background: var(--surface-bg);
}
.preview-nav.footer {
  margin-top: auto;
}
.preview-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  min-width: 0;
  pointer-events: auto;   /* 内容区恢复响应（不影响拖拽预览背景） */
}

/* ---- Dashboard preview ---- */
.pv-dashboard { display: flex; flex-direction: column; gap: 16px; }
.pv-date { font-size: 12px; color: var(--color-text-tertiary); }
.pv-greet {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.4;
}
.pv-row { display: flex; gap: 12px; flex-wrap: wrap; }
.pv-col { display: flex; flex-direction: column; }
.gap-3 { gap: 12px; }
.mb-4 { margin-bottom: 16px; }
.mt-3 { margin-top: 12px; }
.pv-chip { flex: 1; min-width: 100px; }
.chip-title { font-size: 11px; color: var(--color-text-tertiary); }
.chip-val {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-top: 2px;
}
.pv-section-title {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--color-text-tertiary);
  margin-top: 8px; margin-bottom: 8px;
  font-weight: 600;
}
.pv-events { display: flex; flex-direction: column; gap: 8px; }
.pv-event {
  display: flex; gap: 12px; align-items: center;
  padding: 12px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  border-left: 3px solid var(--c);
}
.pv-event .dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--c);
  margin-top: 3px; flex-shrink: 0;
}
.pv-event .et {
  font-size: 13px; font-weight: 500;
  color: var(--color-text-primary);
}
.pv-event .em {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 2px;
}
.pv-event > div:nth-child(2) { flex: 1; min-width: 0; }
.pv-components {
  display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
}

/* ---- Solo preview (button/badge/input/card) ---- */
.pv-solo { display: flex; flex-direction: column; }
.c-title {
  font-size: 13px; font-weight: 600;
  color: var(--color-text-primary);
}
.c-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
  line-height: 1.6;
}
.nested { background: var(--surface-bg); }

/* ==================== 控制面板 ====================
   这一部分是 Design Lab 自身控件，全部硬编码固定颜色与样式，
   不再跟随调试 Token（RGB/预设/玻璃参数）变化。
   中间的 MYMEMO Preview 才随 Token 变化。
   ===================================================== */
.control-section {
  overflow-y: auto;
  min-width: 0; min-height: 0;
  padding-right: 4px;
}
.control-panel {
  display: flex; flex-direction: column; gap: 16px;
}
.control-group-title {
  font-size: 11px;
  letter-spacing: 1px;
  color: #a29482;
  margin-bottom: 12px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.control-desc {
  font-size: 12px;
  color: #7a6b5c;
  margin-bottom: 12px;
  line-height: 1.6;
}
.control-desc b { color: #4a3f35; font-weight: 600; }
.control-hint {
  font-size: 11px;
  color: #a29482;
  line-height: 1.6;
}
.control-list {
  display: flex; flex-direction: column; gap: 16px;
}
.field-label {
  font-size: 12px;
  color: #7a6b5c;
  margin-bottom: 8px;
}
.field-row {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: -8px;
}
.field-row .field-label { margin-bottom: 0; }
.field-value {
  font-size: 11px;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #a29482;
}

/* ---- 壁纸 / 按钮类（调试工具固定样式） ---- */
.wallpaper-actions { display: flex; gap: 8px; }
.upload-btn {
  flex: 1; text-align: center; padding: 8px;
  font-size: 12px;
  background: #fff;
  border: 1px solid rgba(139, 111, 92, 0.14);
  border-radius: 12px;
  color: #7a6b5c;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.upload-btn:hover {
  background: rgba(255, 255, 255, 0.78);
  color: #4a3f35;
}
.clear-btn {
  padding: 8px 14px;
  font-size: 12px;
  background: transparent;
  border: 1px solid rgba(139, 111, 92, 0.14);
  border-radius: 12px;
  color: #a29482;
  cursor: pointer;
}
.clear-btn:hover {
  color: #c96a5a;
  border-color: rgba(201, 106, 90, 0.35);
}
.reset-btn {
  align-self: flex-start;
  padding: 6px 14px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(139, 111, 92, 0.14);
  border-radius: 10px;
  color: #7a6b5c;
  cursor: pointer;
}
.reset-btn:hover {
  border-color: rgba(139, 111, 92, 0.30);
  color: #4a3f35;
}

.preset-row { display: flex; gap: 8px; flex-wrap: wrap; }
.preset-btn {
  padding: 6px 12px;
  background: #fff;
  border: 1px solid rgba(139, 111, 92, 0.14);
  border-radius: 10px;
  font-size: 11px;
  color: #7a6b5c;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.preset-btn:hover {
  background: rgba(255, 255, 255, 0.78);
  color: #4a3f35;
}
.preset-btn.active {
  background: rgba(255, 255, 255, 0.78);
  border-color: rgba(139, 111, 92, 0.25);
  color: #4a3f35;
}

.preset-list {
  display: flex; flex-direction: column; gap: 8px;
}
.preset-btn-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid rgba(139, 111, 92, 0.14);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.preset-btn-row:hover {
  background: rgba(255, 255, 255, 0.78);
  border-color: rgba(139, 111, 92, 0.25);
}
.preset-btn-row.active {
  border-color: rgba(139, 111, 92, 0.25);
  background: rgba(255, 255, 255, 0.78);
}
.preset-dots { display: flex; gap: 3px; }
.preset-dots span {
  width: 14px; height: 14px; border-radius: 50%;
  border: 1px solid rgba(139, 111, 92, 0.08);
}
.preset-name {
  flex: 1; text-align: left;
  font-size: 12px;
  color: #7a6b5c;
}
.customize-hint {
  font-size: 11px;
  color: #8b6f5c;
  font-weight: 500;
}
.base-preset {
  font-size: 11px;
  color: #a29482;
  font-weight: 400;
  letter-spacing: 0;
}
.color-meta {
  display: flex; justify-content: flex-end;
  margin-bottom: 16px;
}
.restore-btn {
  font-size: 11px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(139, 111, 92, 0.14);
  border-radius: 10px;
  color: #7a6b5c;
  cursor: pointer;
}
.restore-btn:hover {
  color: #8b6f5c;
  border-color: rgba(139, 111, 92, 0.30);
}
.rgb-group {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px dashed rgba(139, 111, 92, 0.14);
}
.rgb-group:last-child {
  border-bottom: none; margin-bottom: 0;
}
.rgb-header {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 12px;
}
.rgb-swatch {
  width: 32px; height: 32px;
  border-radius: 8px; flex-shrink: 0;
  border: 1px solid rgba(139, 111, 92, 0.14);
}
.rgb-header > div { flex: 1; min-width: 0; }
.rgb-title {
  font-size: 12px; font-weight: 600;
  color: #4a3f35;
}
.rgb-value {
  font-size: 11px;
  color: #a29482;
  margin-top: 2px;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.color-picker {
  width: 38px; height: 32px;
  padding: 2px;
  border: 1px solid rgba(139, 111, 92, 0.14);
  border-radius: 8px;
  background: transparent;
  cursor: pointer; flex-shrink: 0;
}

/* 组件预览目录 */
.component-toc {
  display: flex; flex-direction: column; gap: 8px;
  margin-top: 12px;
}
.toc-btn {
  text-align: left; padding: 10px 14px;
  background: #fff;
  border: 1px solid rgba(139, 111, 92, 0.14);
  border-radius: 12px;
  font-size: 12px;
  color: #7a6b5c;
  cursor: pointer;
}
.toc-btn:hover {
  background: rgba(255, 255, 255, 0.78);
  color: #4a3f35;
}

/* 细滚动条（面板右侧，调试工具固定样式） */
.control-section::-webkit-scrollbar {
  width: 6px;
}
.control-section::-webkit-scrollbar-track {
  background: transparent;
}
.control-section::-webkit-scrollbar-thumb {
  background: rgba(139, 111, 92, 0.15);
  border-radius: 3px;
}
.control-section::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 111, 92, 0.28);
}
</style>

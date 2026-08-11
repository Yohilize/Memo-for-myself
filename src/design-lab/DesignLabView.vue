<script setup lang="ts">
import { ref } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseSlider from '@/components/base/BaseSlider.vue'
import { useTokenControls } from './useTokenControls'

const { state, resetTokens, setWallpaper } = useTokenControls()

const activeTab = ref<'tokens' | 'components'>('tokens')

const presetColors = [
  { name: '紫蓝粉', p: '#a855f7', a: '#3b82f6', a2: '#ec4899' },
  { name: '海洋蓝', p: '#06b6d4', a: '#3b82f6', a2: '#8b5cf6' },
  { name: '樱花粉', p: '#ec4899', a: '#f472b6', a2: '#f59e0b' },
  { name: '森林绿', p: '#10b981', a: '#06b6d4', a2: '#84cc16' },
  { name: '日落橙', p: '#f59e0b', a: '#ef4444', a2: '#ec4899' },
]

function applyPreset(preset: (typeof presetColors)[number]) {
  state.primaryColor = preset.p
  state.accentColor = preset.a
  state.accent2Color = preset.a2
}

function onWallpaperUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = () => setWallpaper(reader.result as string)
    reader.readAsDataURL(file)
  }
}

function clearWallpaper() {
  setWallpaper('')
}

function exportTokens() {
  const css = `:root {\n  --glass-blur: ${state.glassBlur}px;\n  --glass-bg: rgba(255,255,255,${(state.glassOpacity / 100).toFixed(2)});\n  --glass-radius: ${state.glassRadius}px;\n  --bg-mask-opacity: ${state.bgMaskOpacity};\n  --bg-image-opacity: ${state.bgImageOpacity};\n  --bg-orb-opacity: ${state.orbOpacity};\n  --app-width: ${state.appWidth}vw;\n  --color-primary: ${state.primaryColor};\n  --color-accent: ${state.accentColor};\n  --color-accent-2: ${state.accent2Color};\n}`
  navigator.clipboard.writeText(css)
  alert('CSS 变量已复制到剪贴板')
}
</script>

<template>
  <div class="design-lab">
    <!-- 顶部标题栏 -->
    <header class="lab-header">
      <div>
        <h1 class="lab-title">Design Lab</h1>
        <p class="lab-subtitle">MYMEMO 视觉参数实验室 · 调整后自动保存到浏览器</p>
      </div>
      <div class="lab-actions">
        <div class="tab-switch">
          <button :class="{ active: activeTab === 'tokens' }" @click="activeTab = 'tokens'">
            Token 调节
          </button>
          <button :class="{ active: activeTab === 'components' }" @click="activeTab = 'components'">
            组件预览
          </button>
        </div>
        <BaseButton variant="ghost" size="sm" @click="resetTokens">重置</BaseButton>
        <BaseButton variant="primary" size="sm" @click="exportTokens">导出 CSS</BaseButton>
      </div>
    </header>

    <div class="lab-body">
      <!-- 左侧：实时预览 -->
      <section class="preview-section">
        <div class="preview-label">实时预览</div>
        <div class="preview-stage">
          <div class="preview-app">
            <!-- 模拟侧边栏 -->
            <div class="preview-sidebar">
              <div class="preview-logo">M</div>
              <div class="preview-nav active">📅</div>
              <div class="preview-nav">⏰</div>
              <div class="preview-nav">💡</div>
            </div>
            <!-- 模拟内容 -->
            <div class="preview-content">
              <div class="preview-date">2026年8月11日</div>
              <div class="preview-events">
                <div class="preview-event" style="--c: var(--color-event-calendar)">
                  <span class="dot"></span>
                  <div>
                    <div class="ev-title">晨会</div>
                    <div class="ev-meta">09:00 - 09:30 · 日历事件</div>
                  </div>
                </div>
                <div class="preview-event" style="--c: var(--color-event-duration)">
                  <span class="dot"></span>
                  <div>
                    <div class="ev-title">深度工作：写方案</div>
                    <div class="ev-meta">10:00 - 12:00 · 时间块 (2h)</div>
                  </div>
                </div>
                <div class="preview-event" style="--c: var(--color-event-deadline)">
                  <span class="dot"></span>
                  <div>
                    <div class="ev-title">项目方案截止</div>
                    <div class="ev-meta">18:00 · Deadline · 还剩2天</div>
                  </div>
                </div>
                <div class="preview-event" style="--c: var(--color-event-idea)">
                  <span class="dot"></span>
                  <div>
                    <div class="ev-title">做一个时间统计看板</div>
                    <div class="ev-meta">💡 灵感 · 2小时前</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 右侧：控制面板 -->
      <aside class="control-section">
        <!-- Token 调节 -->
        <div v-if="activeTab === 'tokens'" class="control-panel">
          <BaseCard padding="md">
            <h3 class="control-group-title">玻璃质感</h3>
            <div class="control-list">
              <BaseSlider v-model="state.glassBlur" :min="0" :max="40" unit="px"
                label="模糊强度" />
              <BaseSlider v-model="state.glassOpacity" :min="2" :max="25" unit="%"
                label="面板透明度" />
              <BaseSlider v-model="state.glassRadius" :min="0" :max="32" unit="px"
                label="圆角大小" />
            </div>
          </BaseCard>

          <BaseCard padding="md">
            <h3 class="control-group-title">背景层</h3>
            <div class="control-list">
              <BaseSlider v-model="state.bgMaskOpacity" :min="0" :max="0.8" :step="0.05"
                label="遮罩浓度" />
              <BaseSlider v-model="state.bgImageOpacity" :min="0" :max="1" :step="0.05"
                label="壁纸透明度" />
              <BaseSlider v-model="state.orbOpacity" :min="0" :max="1" :step="0.05"
                label="光球强度" />
            </div>
            <div class="wallpaper-actions">
              <label class="upload-btn">
                <input type="file" accept="image/*" hidden @change="onWallpaperUpload" />
                上传壁纸
              </label>
              <button class="clear-btn" @click="clearWallpaper">清除壁纸</button>
            </div>
          </BaseCard>

          <BaseCard padding="md">
            <h3 class="control-group-title">主题配色</h3>
            <div class="preset-list">
              <button v-for="preset in presetColors" :key="preset.name" class="preset-btn"
                @click="applyPreset(preset)">
                <span class="preset-dots">
                  <span :style="{ background: preset.p }"></span>
                  <span :style="{ background: preset.a }"></span>
                  <span :style="{ background: preset.a2 }"></span>
                </span>
                <span class="preset-name">{{ preset.name }}</span>
              </button>
            </div>
            <div class="color-row">
              <label>主色 <input type="color" v-model="state.primaryColor" /></label>
              <label>强调 <input type="color" v-model="state.accentColor" /></label>
              <label>点缀 <input type="color" v-model="state.accent2Color" /></label>
            </div>
          </BaseCard>

          <BaseCard padding="md">
            <h3 class="control-group-title">布局</h3>
            <BaseSlider v-model="state.appWidth" :min="50" :max="100" unit="vw"
              label="中央面板宽度" />
          </BaseCard>
        </div>

        <!-- 组件预览 -->
        <div v-else class="control-panel">
          <BaseCard padding="md">
            <h3 class="control-group-title">按钮</h3>
            <div class="component-row">
              <BaseButton variant="primary">Primary</BaseButton>
              <BaseButton variant="secondary">Secondary</BaseButton>
              <BaseButton variant="ghost">Ghost</BaseButton>
              <BaseButton variant="danger">Danger</BaseButton>
            </div>
            <div class="component-row">
              <BaseButton variant="primary" size="sm">Small</BaseButton>
              <BaseButton variant="primary" size="md">Medium</BaseButton>
              <BaseButton variant="primary" size="lg">Large</BaseButton>
            </div>
          </BaseCard>

          <BaseCard padding="md">
            <h3 class="control-group-title">徽章</h3>
            <div class="component-row">
              <BaseBadge color="var(--color-event-calendar)">日历</BaseBadge>
              <BaseBadge color="var(--color-event-deadline)">截止</BaseBadge>
              <BaseBadge color="var(--color-event-duration)">时间块</BaseBadge>
              <BaseBadge color="var(--color-event-idea)">灵感</BaseBadge>
              <BaseBadge color="var(--color-danger)">逾期</BaseBadge>
              <BaseBadge color="var(--color-success)">完成</BaseBadge>
            </div>
            <div class="component-row" style="margin-top: 8px">
              <BaseBadge variant="solid" color="var(--color-primary)">Solid</BaseBadge>
              <BaseBadge variant="outline" color="var(--color-primary)">Outline</BaseBadge>
            </div>
          </BaseCard>

          <BaseCard padding="md">
            <h3 class="control-group-title">输入框</h3>
            <BaseInput placeholder="输入内容..." />
          </BaseCard>

          <BaseCard padding="md">
            <h3 class="control-group-title">卡片</h3>
            <BaseCard padding="sm" class="nested-card">
              <div style="font-size: 12px; color: var(--color-text-secondary)">
                嵌套卡片 — 玻璃面板中的次级表面
              </div>
            </BaseCard>
          </BaseCard>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.design-lab {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--space-6);
  overflow: hidden;
}

.lab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
  flex-shrink: 0;
}

.lab-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  background: var(--gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.lab-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  margin-top: var(--space-1);
}

.lab-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.tab-switch {
  display: flex;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  padding: 3px;
}

.tab-switch button {
  padding: 6px 16px;
  font-size: var(--text-sm);
  border-radius: 8px;
  color: var(--color-text-tertiary);
  transition: all var(--duration-fast) var(--ease-out);
}

.tab-switch button.active {
  background: var(--glass-bg-hover);
  color: var(--color-text-primary);
}

.lab-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--space-5);
  overflow: hidden;
}

.preview-section {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-label {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-3);
}

.preview-stage {
  flex: 1;
  border-radius: var(--glass-radius);
  overflow: hidden;
  position: relative;
  background: var(--bg-gradient);
}

.preview-app {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}

.preview-app > div {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  width: var(--app-width);
  max-width: 900px;
  height: 80%;
  border-radius: var(--glass-radius);
  display: flex;
  overflow: hidden;
}

.preview-sidebar {
  width: 56px;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  border-right: 1px solid var(--surface-border);
}

.preview-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-bold);
  color: white;
  margin-bottom: var(--space-2);
}

.preview-nav {
  width: 36px;
  height: 36px;
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

.preview-content {
  flex: 1;
  padding: var(--space-5);
  overflow-y: auto;
}

.preview-date {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-4);
}

.preview-events {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.preview-event {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  padding: var(--space-3);
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  border-left: 3px solid var(--c);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c);
  margin-top: 4px;
  flex-shrink: 0;
}

.ev-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
}

.ev-meta {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.control-section {
  overflow-y: auto;
}

.control-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.control-group-title {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-3);
  font-weight: var(--font-semibold);
}

.control-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.wallpaper-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.upload-btn {
  flex: 1;
  text-align: center;
  padding: 8px;
  font-size: var(--text-sm);
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.upload-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text-primary);
}

.clear-btn {
  padding: 8px 14px;
  font-size: var(--text-sm);
  background: transparent;
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  color: var(--color-text-tertiary);
  cursor: pointer;
}

.clear-btn:hover {
  color: var(--color-danger-light);
  border-color: rgba(239, 68, 68, 0.3);
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.preset-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 8px 12px;
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.preset-btn:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
}

.preset-dots {
  display: flex;
  gap: 3px;
}

.preset-dots span {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.preset-name {
  flex: 1;
  text-align: left;
}

.color-row {
  display: flex;
  gap: var(--space-3);
}

.color-row label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.color-row input[type='color'] {
  width: 100%;
  height: 32px;
  border: 1px solid var(--surface-border);
  border-radius: var(--surface-radius);
  background: transparent;
  cursor: pointer;
  padding: 2px;
}

.component-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.nested-card {
  display: block;
}
</style>

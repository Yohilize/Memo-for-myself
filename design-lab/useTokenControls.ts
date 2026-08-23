import { reactive, ref, watch } from 'vue'
import { useFixedBackgroundStore } from '@/stores'
import { STORAGE_KEYS } from '@/services/storageKeys'
import type { BackgroundSettings } from '@/db/database'

/**
 * Design Lab Token 控制器
 * 运行时修改 CSS 变量，实时反馈到浏览器根元素。
 * 背景图参数：基于"居中+cover"基准，通过 offsetX/offsetY/bgScale 做连续变换，
 * 与 BackgroundLayer.vue 的 <img>+transform 模型一一对应。
 */

export interface TokenState {
  // 玻璃质感
  glassBlur: number
  glassOpacity: number
  glassRadius: number
  // 背景层
  bgMaskOpacity: number
  bgImageOpacity: number
  bgOrbOpacity: number
  bgImageBlur: number
  // 背景图片（连续参数模型，直接对应用户实际拖拽/缩放结果）
  bgOffsetX: number   // 相对中心的横向偏移（px）
  bgOffsetY: number   // 相对中心的纵向偏移（px）
  bgScale: number     // 1.0 = cover（填满视口且保留图片原始比例）
  // 布局
  appWidth: number
  // 主题色
  primaryColor: string
  accentColor: string
  accent2Color: string
}

/* 预设全部取材自 icon_orgin.jpg 色盘做小幅变化：
 * 暖棕发丝 / 陶土红丝带 / 米白领 / 暖灰阴影
 */
export const PRESETS: { name: string; p: string; a: string; a2: string }[] = [
  { name: '原画风（推荐）', p: '#8b6f5c', a: '#c96a5a', a2: '#b8a092' },
  { name: '柔樱日记',     p: '#a8837a', a: '#d89a8d', a2: '#c9b5a4' },
  { name: '苔原暖调',     p: '#7e896f', a: '#c9a07a', a2: '#b8a092' },
  { name: '手冲奶茶',     p: '#a38875', a: '#caa07a', a2: '#d8bba4' },
  { name: '晚霞薄纸',     p: '#8b6f5c', a: '#c97a6a', a2: '#e5b8aa' },
]

const DEFAULT_PRESET = PRESETS[0]

const defaults: TokenState = {
  glassBlur: 14,
  glassOpacity: 52,
  glassRadius: 20,
  bgMaskOpacity: 0,
  bgImageOpacity: 0.55,
  bgOrbOpacity: 0.35,
  bgImageBlur: 0,
  bgOffsetX: 0,
  bgOffsetY: 0,
  bgScale: 1.0,
  appWidth: 66,
  primaryColor: DEFAULT_PRESET.p,
  accentColor: DEFAULT_PRESET.a,
  accent2Color: DEFAULT_PRESET.a2,
}

const STORAGE_KEY = STORAGE_KEYS.designLabTokens

function loadState(): TokenState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...defaults, ...JSON.parse(saved) }
  } catch {
    // ignore
  }
  return { ...defaults }
}

export const state = reactive<TokenState>(loadState())

export const presetSnapshot = reactive({
  base: DEFAULT_PRESET.name,
})

export function applyTokens(s: TokenState) {
  const root = document.documentElement
  // 玻璃
  root.style.setProperty('--glass-blur', `${s.glassBlur}px`)
  root.style.setProperty('--glass-bg', `rgba(255,255,255,${s.glassOpacity / 100})`)
  root.style.setProperty('--glass-bg-hover', `rgba(255,255,255,${(s.glassOpacity + 16) / 100})`)
  root.style.setProperty('--glass-radius', `${s.glassRadius}px`)
  // 背景层
  root.style.setProperty('--bg-mask-opacity', String(s.bgMaskOpacity))
  root.style.setProperty('--bg-image-opacity', String(s.bgImageOpacity))
  root.style.setProperty('--bg-image-blur', `${s.bgImageBlur}px`)
  root.style.setProperty('--bg-orb-opacity', String(s.bgOrbOpacity))
  // 背景图 —— 新的连续模型（取代 bgImageSize/bgImagePosition）
  root.style.setProperty('--bg-offset-x', `${s.bgOffsetX}px`)
  root.style.setProperty('--bg-offset-y', `${s.bgOffsetY}px`)
  root.style.setProperty('--bg-scale', String(s.bgScale))
  // 布局
  root.style.setProperty('--app-width', `${s.appWidth}vw`)
  // 颜色（顶层旋钮）
  root.style.setProperty('--color-primary', s.primaryColor)
  root.style.setProperty('--color-accent', s.accentColor)
  root.style.setProperty('--color-accent-2', s.accent2Color)
  root.style.setProperty(
    '--gradient-primary',
    `linear-gradient(135deg, ${s.primaryColor}, ${s.accentColor})`,
  )
  root.style.setProperty(
    '--gradient-text',
    `linear-gradient(135deg, ${s.primaryColor}, ${s.accentColor})`,
  )
  // 注意：以下语义 Token 不再在 JS 中硬编码写入，
  // 而是由 tokens.css 通过 color-mix() 从 primary/accent/accent-2 实时派生：
  //   光球（--bg-orb-color-1/2/3）、背景渐变（--bg-gradient）、
  //   玻璃边框/阴影（--glass-border / --glass-shadow 等）、
  //   Surface 边框、柔和底色、文字层次、danger/success/warning 的亮色。
  // 因此上面只写入三个顶层旋钮 + 两条显式渐变即可，
  // 浏览器会自动级联重新计算整套语义色，主题切换的视觉范围立刻覆盖整界面。
}

export function resetTokens() {
  Object.assign(state, defaults)
}

/** 应用预设（完整覆盖三个颜色） */
export function applyPreset(name: string) {
  const preset = PRESETS.find((p) => p.name === name)
  if (!preset) return
  state.primaryColor = preset.p
  state.accentColor = preset.a
  state.accent2Color = preset.a2
  presetSnapshot.base = preset.name
}

/** 恢复到"基于的那个预设"的原始值 */
export function restoreBasePreset() {
  applyPreset(presetSnapshot.base)
}

/** 背景图 URL 单独处理（不写入 localStorage，通常是临时 base64）
 *  必须为 reactive ref，否则 DesignLabView.vue 中
 *  `computed(() => getWallpaper())` 不会在上传后重新求值，
 *  导致预览区 background-image 永远不更新。
 */
const currentWallpaper = ref('')
export function setWallpaper(url: string) {
  currentWallpaper.value = url
  if (url) {
    document.documentElement.style.setProperty('--bg-image-url', `url("${url}")`)
  } else {
    document.documentElement.style.setProperty('--bg-image-url', 'none')
  }
}
export function getWallpaper(): string {
  return currentWallpaper.value
}

watch(
  state,
  (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    } catch {
      // storage full or disabled
    }
    applyTokens(val)
  },
  { deep: true },
)

applyTokens(state)

export function exportTokensAsCss(): string {
  const lines = [
    `/* 导出自 Design Lab ${new Date().toISOString()} */`,
    ':root {',
    `  --glass-blur: ${state.glassBlur}px;`,
    `  --glass-bg: rgba(255,255,255,${(state.glassOpacity / 100).toFixed(2)});`,
    `  --glass-radius: ${state.glassRadius}px;`,
    `  --bg-mask-opacity: ${state.bgMaskOpacity};`,
    `  --bg-image-opacity: ${state.bgImageOpacity};`,
    `  --bg-image-blur: ${state.bgImageBlur}px;`,
    `  --bg-offset-x: ${state.bgOffsetX}px;`,
    `  --bg-offset-y: ${state.bgOffsetY}px;`,
    `  --bg-scale: ${state.bgScale};`,
    `  --bg-orb-opacity: ${state.bgOrbOpacity};`,
    `  --app-width: ${state.appWidth}vw;`,
    `  --color-primary: ${state.primaryColor};`,
    `  --color-accent: ${state.accentColor};`,
    `  --color-accent-2: ${state.accent2Color};`,
    '}',
  ]
  return lines.join('\n')
}

/** 背景图重置：位置归零，缩放=1.0 */
export function resetWallpaperTransform() {
  state.bgOffsetX = 0
  state.bgOffsetY = 0
  state.bgScale = 1.0
}

// ==========================================================================
// 「固定当前背景」机制：
//   DSL 编辑时所有滑块 / 壁纸上传修改的都是 state + currentWallpaper（temp），
//   全局 CSS var 只影响 DSL 预览区的 .preview-stage；主界面 BackgroundLayer
//   已通过 inline style 自行从 useFixedBackgroundStore 读取，不跟随 temp 变化。
//
//   只有用户点击「固定当前背景」时，才把「当前 temp 值的快照」写入
//   fixedBackground Pinia store + Dexie IndexedDB，主界面背景才真正更新
//   并在刷新后仍然存在。
// ==========================================================================

/** 从 DSL 临时 state 中提取出「背景相关字段」的快照（不含 id / updatedAt） */
export function snapshotTempBackground(): Omit<BackgroundSettings, 'id' | 'updatedAt'> {
  return {
    wallpaperDataUrl: currentWallpaper.value ?? '',
    bgOffsetX: state.bgOffsetX,
    bgOffsetY: state.bgOffsetY,
    bgScale: state.bgScale,
    bgImageOpacity: state.bgImageOpacity,
    bgImageBlur: state.bgImageBlur,
    bgMaskOpacity: state.bgMaskOpacity,
    bgOrbOpacity: state.bgOrbOpacity,
  }
}

/**
 * 把「当前 DSL 临时编辑的背景（图片 + 8 个参数）」固定为正式背景：
 *  1. 写入 fixedBackground Pinia store → 主界面 BackgroundLayer 立刻响应式更新。
 *  2. 写入 Dexie IndexedDB（backgroundSettings 表，单条 'default'）→ 刷新后仍然存在。
 *
 * @returns 写入成功后 fixedStore 返回的完整 BackgroundSettings 记录
 */
export async function saveCurrentBackgroundAsFixed(): Promise<BackgroundSettings> {
  const fbStore = useFixedBackgroundStore()
  const snapshot = snapshotTempBackground()
  const record = await fbStore.save(snapshot)
  return record
}

/**
 * 同步 DSL 的临时编辑状态（temp）为「当前固定背景」的值。
 * 场景：用户刚打开 DSL，想基于"现有正式背景"继续微调，而不是从零开始。
 * —— 不自动调用，按需在 DSL 组件中手动触发（如进入背景 tab 时提示）。
 */
export async function loadFixedAsTemp() {
  const fbStore = useFixedBackgroundStore()
  // 确保 store 已初始化
  if (!fbStore.initialized) {
    await fbStore.load()
  }
  // wallpaper
  currentWallpaper.value = fbStore.wallpaperDataUrl || ''
  if (currentWallpaper.value) {
    document.documentElement.style.setProperty(
      '--bg-image-url',
      `url("${currentWallpaper.value}")`,
    )
  } else {
    document.documentElement.style.setProperty('--bg-image-url', 'none')
  }
  // 8 个背景参数（仅写背景相关；不动颜色 / 玻璃 / appWidth）
  state.bgOffsetX = fbStore.bgOffsetX
  state.bgOffsetY = fbStore.bgOffsetY
  state.bgScale = fbStore.bgScale
  state.bgImageOpacity = fbStore.bgImageOpacity
  state.bgImageBlur = fbStore.bgImageBlur
  state.bgMaskOpacity = fbStore.bgMaskOpacity
  state.bgOrbOpacity = fbStore.bgOrbOpacity
}

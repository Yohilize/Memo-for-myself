import { reactive, ref, watch } from 'vue'

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

const STORAGE_KEY = 'mymemo-design-lab-tokens'

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

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

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
  // 颜色
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
  root.style.setProperty('--bg-orb-color-1', '#fce5d7')
  root.style.setProperty('--bg-orb-color-2', '#c9b5a4')
  root.style.setProperty('--bg-orb-color-3', '#e5b8aa')
  root.style.setProperty(
    '--bg-gradient',
    'radial-gradient(ellipse at 22% 18%, ' + hexToRgba('#fce5d7', 0.55) + ' 0%, transparent 52%),' +
      'radial-gradient(ellipse at 78% 22%, ' + hexToRgba('#c9b5a4', 0.30) + ' 0%, transparent 50%),' +
      'radial-gradient(ellipse at 50% 85%, ' + hexToRgba(s.accentColor, 0.14) + ' 0%, transparent 55%),' +
      'linear-gradient(160deg, #fdf9f4 0%, #faf3ec 45%, #f6ede3 100%)',
  )
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

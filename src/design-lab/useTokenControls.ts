import { reactive, watch } from 'vue'

/**
 * Design Lab Token 控制器
 * 在运行时修改 CSS 变量，实时预览效果。
 * 独立于业务逻辑，不引用任何 service/store。
 */

export interface TokenState {
  // 玻璃质感
  glassBlur: number
  glassOpacity: number
  glassRadius: number
  // 背景层
  bgMaskOpacity: number
  bgImageOpacity: number
  orbOpacity: number
  // 布局
  appWidth: number
  // 主题色
  primaryColor: string
  accentColor: string
  accent2Color: string
}

const defaults: TokenState = {
  glassBlur: 16,
  glassOpacity: 55,
  glassRadius: 20,
  bgMaskOpacity: 0,
  bgImageOpacity: 0.4,
  orbOpacity: 0.35,
  appWidth: 66,
  primaryColor: '#b8866d',
  accentColor: '#8ba888',
  accent2Color: '#d4a574',
}

const STORAGE_KEY = 'mymemo-design-lab-tokens'

function loadState(): TokenState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...defaults, ...JSON.parse(saved) }
  } catch {
    // ignore parse errors
  }
  return { ...defaults }
}

const state = reactive<TokenState>(loadState())

function applyTokens(s: TokenState) {
  const root = document.documentElement
  root.style.setProperty('--glass-blur', `${s.glassBlur}px`)
  root.style.setProperty('--glass-bg', `rgba(255,255,255,${s.glassOpacity / 100})`)
  root.style.setProperty('--glass-bg-hover', `rgba(255,255,255,${(s.glassOpacity + 4) / 100})`)
  root.style.setProperty('--glass-radius', `${s.glassRadius}px`)
  root.style.setProperty('--bg-mask-opacity', String(s.bgMaskOpacity))
  root.style.setProperty('--bg-image-opacity', String(s.bgImageOpacity))
  root.style.setProperty('--bg-orb-opacity', String(s.orbOpacity))
  root.style.setProperty('--app-width', `${s.appWidth}vw`)
  root.style.setProperty('--color-primary', s.primaryColor)
  root.style.setProperty('--color-accent', s.accentColor)
  root.style.setProperty('--color-accent-2', s.accent2Color)
  root.style.setProperty(
    '--gradient-primary',
    `linear-gradient(135deg, ${s.primaryColor}, ${s.accentColor})`,
  )
  root.style.setProperty(
    '--bg-orb-color-1',
    s.primaryColor,
  )
  root.style.setProperty(
    '--bg-orb-color-2',
    s.accentColor,
  )
  root.style.setProperty(
    '--bg-orb-color-3',
    s.accent2Color,
  )
  root.style.setProperty(
    '--bg-gradient',
    `radial-gradient(ellipse at 20% 15%, ${hexToRgba(s.primaryColor, 0.18)} 0%, transparent 50%),` +
      `radial-gradient(ellipse at 80% 25%, ${hexToRgba(s.accentColor, 0.15)} 0%, transparent 50%),` +
      `radial-gradient(ellipse at 50% 85%, ${hexToRgba(s.accent2Color, 0.12)} 0%, transparent 50%),` +
      'linear-gradient(160deg, #fdf8f2 0%, #f7f0e8 45%, #f2ebe2 100%)',
  )
  root.style.setProperty(
    '--gradient-text',
    `linear-gradient(135deg, ${s.primaryColor}, ${s.accentColor})`,
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function resetTokens() {
  Object.assign(state, defaults)
}

function setWallpaper(url: string) {
  if (url) {
    document.documentElement.style.setProperty('--bg-image-url', `url("${url}")`)
    document.documentElement.style.setProperty('--bg-image-opacity', String(state.bgImageOpacity))
  } else {
    document.documentElement.style.setProperty('--bg-image-url', 'none')
  }
}

// 持久化
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

// 初始化时立即应用
applyTokens(state)

export function useTokenControls() {
  return {
    state,
    resetTokens,
    setWallpaper,
  }
}

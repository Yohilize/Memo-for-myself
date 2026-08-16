import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { backgroundRepository } from '@/repositories'
import type { BackgroundSettings } from '@/db/database'

/**
 * 固定背景 Store（主界面 BackgroundLayer 唯一真源）。
 *
 * 与 DSL 临时编辑状态（useTokenControls reactive state + currentWallpaper ref）完全解耦：
 *  - DSL 中的滑块 / 拖拽 / 上传修改的是「temp」，只会实时影响 DSL 预览区，
 *    绝不会影响 BackgroundLayer。
 *  - 用户点击「固定当前背景」后，DSL 会调用本 store 的 saveFromCurrentTemp()，
 *    此时才写入 IndexedDB 并刷新本 store 中的响应式值，
 *    进而驱动 BackgroundLayer（主界面背景）真正更新。
 *
 *  颜色 / 玻璃 / 布局 Token 仍然走 useTokenControls（立即全局生效）；
 *  只有「壁纸 + 8 个背景参数」走这套"临时 vs 固定"的双轨机制。
 */

/** 与 useTokenControls defaults 中背景相关字段保持一致（单一真源靠 test/校验）。
 *  注意：此处 wallpaperDataUrl 为必填 string（空串代表"无壁纸"），与 BackgroundSettings 接口中的
 *       optional 字段不同 —— 接口允许 undefined 便于 Dexie 存储；而运行时默认值始终是确定的。 */
type FixedBackgroundDefaults = Required<Omit<BackgroundSettings, 'id' | 'updatedAt'>>
export const FIXED_BACKGROUND_DEFAULTS: FixedBackgroundDefaults = {
  wallpaperDataUrl: '',
  bgOffsetX: 0,
  bgOffsetY: 0,
  bgScale: 1.0,
  bgImageOpacity: 0.55,
  bgImageBlur: 0,
  bgMaskOpacity: 0,
  bgOrbOpacity: 0.35,
}

export const useFixedBackgroundStore = defineStore('fixedBackground', () => {
  // —— 响应式状态：每个参数独立成 ref，BackgroundLayer 可精确订阅，
  //    且 computed 导出的 style 不会因无关字段变化而重算。—— //
  const wallpaperDataUrl = ref<string>(FIXED_BACKGROUND_DEFAULTS.wallpaperDataUrl)
  const bgOffsetX = ref<number>(FIXED_BACKGROUND_DEFAULTS.bgOffsetX)
  const bgOffsetY = ref<number>(FIXED_BACKGROUND_DEFAULTS.bgOffsetY)
  const bgScale = ref<number>(FIXED_BACKGROUND_DEFAULTS.bgScale)
  const bgImageOpacity = ref<number>(FIXED_BACKGROUND_DEFAULTS.bgImageOpacity)
  const bgImageBlur = ref<number>(FIXED_BACKGROUND_DEFAULTS.bgImageBlur)
  const bgMaskOpacity = ref<number>(FIXED_BACKGROUND_DEFAULTS.bgMaskOpacity)
  const bgOrbOpacity = ref<number>(FIXED_BACKGROUND_DEFAULTS.bgOrbOpacity)
  const updatedAt = ref<string | null>(null)

  const loading = ref(false)
  const error = ref<string | null>(null)

  /** 是否已从 DB 加载过；避免首屏闪烁（先显示默认 → 再跳到已保存值）的判断依据 */
  const initialized = ref(false)

  /** 是否有固定壁纸（非空）—— 用于决定 BackgroundLayer 是否渲染 <img> */
  const hasWallpaper = computed(() => !!wallpaperDataUrl.value)

  // =============== Actions =============== //

  function applyRecord(record: BackgroundSettings | undefined) {
    if (!record) {
      // 未固定 → 使用默认背景（零壁纸 + 默认参数）
      wallpaperDataUrl.value = FIXED_BACKGROUND_DEFAULTS.wallpaperDataUrl
      bgOffsetX.value = FIXED_BACKGROUND_DEFAULTS.bgOffsetX
      bgOffsetY.value = FIXED_BACKGROUND_DEFAULTS.bgOffsetY
      bgScale.value = FIXED_BACKGROUND_DEFAULTS.bgScale
      bgImageOpacity.value = FIXED_BACKGROUND_DEFAULTS.bgImageOpacity
      bgImageBlur.value = FIXED_BACKGROUND_DEFAULTS.bgImageBlur
      bgMaskOpacity.value = FIXED_BACKGROUND_DEFAULTS.bgMaskOpacity
      bgOrbOpacity.value = FIXED_BACKGROUND_DEFAULTS.bgOrbOpacity
      updatedAt.value = null
      return
    }
    wallpaperDataUrl.value = record.wallpaperDataUrl ?? ''
    bgOffsetX.value = record.bgOffsetX
    bgOffsetY.value = record.bgOffsetY
    bgScale.value = record.bgScale
    bgImageOpacity.value = record.bgImageOpacity
    bgImageBlur.value = record.bgImageBlur
    bgMaskOpacity.value = record.bgMaskOpacity
    bgOrbOpacity.value = record.bgOrbOpacity
    updatedAt.value = record.updatedAt
  }

  /** 启动时从 IndexedDB 读取，更新响应式 */
  async function load() {
    loading.value = true
    error.value = null
    try {
      const record = await backgroundRepository.get()
      applyRecord(record)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load fixed background'
      applyRecord(undefined)
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  /**
   * 整体写入固定背景（供 DSL saveCurrentBackgroundAsFixed() 调用）。
   * 入参省略 id / updatedAt，由 Repository 负责补全。
   */
  async function save(
    values: Omit<BackgroundSettings, 'id' | 'updatedAt'>,
  ): Promise<BackgroundSettings> {
    loading.value = true
    error.value = null
    try {
      const record = await backgroundRepository.save(values)
      applyRecord(record)
      return record
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save fixed background'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 清除固定背景（恢复默认） */
  async function clear() {
    loading.value = true
    error.value = null
    try {
      await backgroundRepository.clear()
      applyRecord(undefined)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to clear fixed background'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    // state
    wallpaperDataUrl,
    bgOffsetX,
    bgOffsetY,
    bgScale,
    bgImageOpacity,
    bgImageBlur,
    bgMaskOpacity,
    bgOrbOpacity,
    updatedAt,
    loading,
    error,
    initialized,
    // computed
    hasWallpaper,
    // actions
    load,
    save,
    clear,
  }
})

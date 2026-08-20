import Dexie, { type Table } from 'dexie'
import type { TimeEvent } from '@/types/event'

/**
 * 固定背景配置（用户点击「固定当前背景」后持久化的正式背景）
 * 单条记录，主键 id = 'default'
 *
 * 设计：
 *  - 全部使用 base64 DataURL 持久化图片，不使用 Object URL（URL.createObjectURL 是临时的，无法跨刷新存活）
 *  - 8 个背景参数完整镜像 TokenState 中背景相关字段
 *  - 与 DSL 临时编辑状态（useTokenControls state / currentWallpaper）物理分离：
 *      DSL 改的是 temp；只有「固定」后才写入本表，再由 BackgroundLayer / App 启动时读取。
 */
export interface BackgroundSettings {
  id: 'default'
  /** 壁纸 base64 DataURL 字符串；无壁纸时为空串或 undefined */
  wallpaperDataUrl?: string
  /** 背景图横向偏移（px），相对中心 */
  bgOffsetX: number
  /** 背景图纵向偏移（px），相对中心 */
  bgOffsetY: number
  /** 背景图缩放（1.0 = cover） */
  bgScale: number
  /** 图片不透明度（0~1） */
  bgImageOpacity: number
  /** 图片模糊像素（0~20） */
  bgImageBlur: number
  /** 深色遮罩浓度（0~0.6） */
  bgMaskOpacity: number
  /** 光球强度（0~1） */
  bgOrbOpacity: number
  /** 更新时间戳（ISO 字符串），用于调试与一致性校验 */
  updatedAt: string
}

/**
 * 图片组件（Dashboard 上的「图片」小组件）。
 * 每条记录存储一张裁剪后的图片（base64 DataURL），主键 id 与 Dashboard Grid 中的
 * 布局 key 对应（layout 中 key = 图片记录 id），删除组件时据此清理数据。
 *
 * 与背景壁纸一致：全部使用 base64 DataURL 持久化，不使用 Object URL（跨刷新存活）。
 */
export interface ImageWidgetRecord {
  id: string
  /** 裁剪后的 base64 DataURL 字符串 */
  dataUrl: string
  /** 创建时间戳（ISO 字符串） */
  created_at: string
  /** 更新时间戳（ISO 字符串） */
  updated_at: string
}

/**
 * Dexie 数据库定义。
 * 仅在 db/ 层内部使用，不对外暴露。
 * 上层通过 Repository 访问数据，不直接 import db。
 */
class MymemoDatabase extends Dexie {
  events!: Table<TimeEvent, string>
  backgroundSettings!: Table<BackgroundSettings, 'default'>
  imageWidgets!: Table<ImageWidgetRecord, string>

  constructor() {
    super('mymemo')

    // 注：Dexie 的 version 是累加声明；新版本只需要声明新表 / 改动字段，
    // 旧版本中定义的表会被 Dexie 自动保留并迁移。
    this.version(1).stores({
      events: 'id, type, status, created_at, updated_at',
    })

    this.version(2).stores({
      events: 'id, type, status, created_at, updated_at',
      // 单主键行：始终只有 id='default' 一条
      backgroundSettings: 'id',
    })

    this.version(3).stores({
      events: 'id, type, status, created_at, updated_at',
      backgroundSettings: 'id',
      // 图片组件表：主键 id；created_at 用于按创建排序
      imageWidgets: 'id, created_at',
    })
  }
}

export const db = new MymemoDatabase()

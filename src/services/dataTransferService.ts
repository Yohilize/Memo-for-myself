import dayjs from 'dayjs'
import { dataTransferRepository } from '@/repositories/dataTransferRepository'
import { STORAGE_KEY_VALUES, isKnownStorageKey } from './storageKeys'
import type { EventStatus, EventType, Priority, TimeEvent } from '@/types/event'
import type { BackgroundSettings, ImageWidgetRecord } from '@/db/database'

/* ==========================================================================
 * 数据导入 / 导出 Service —— 100% Local-first，不上传任何数据。
 *
 * 职责：
 *  · 导出：从 IndexedDB + localStorage 读取全部「用户运行时数据」，打包成带版本号的 JSON；
 *  · 导入：先整体 schema 校验（不通过则任何数据都不改），再按「覆盖 / 合并」策略写入。
 *
 * 数据范围（与 storageKeys 保持一致的白名单）：
 *  · IndexedDB：events / backgroundSettings / imageWidgets
 *  · localStorage：Dashboard widget 布局、固定事件、时间块开关、Design Lab Token
 *  · 不导出源码、默认 Token、构建信息、机器信息。
 *
 * 架构：UI → 本 Service → Repository → IndexedDB；不直接操作数据库。
 * ========================================================================== */

/** 导出文件格式标识与当前版本（未来模型变化时升 version 并补充迁移脚本） */
export const DATA_FORMAT = 'mymemo' as const
export const DATA_FORMAT_VERSION = 1

/** 导入策略 */
export type ImportStrategy = 'overwrite' | 'merge'

/* ------------------------------- 导出文件结构 ------------------------------- */

export interface MyMemoLocalStorageExport {
  [key: string]: string | undefined
}

export interface MyMemoExportData {
  indexedDB: {
    events: TimeEvent[]
    backgroundSettings: BackgroundSettings | null
    imageWidgets: ImageWidgetRecord[]
  }
  localStorage: MyMemoLocalStorageExport
}

export interface MyMemoExport {
  format: typeof DATA_FORMAT
  version: number
  exportedAt: string
  data: MyMemoExportData
}

export interface ImportResult {
  strategy: ImportStrategy
  /** 覆盖模式：events 全部写入；合并模式：新增条数 */
  eventsAdded: number
  /** 合并模式：因 id 重复而跳过的条数；覆盖模式恒为 0 */
  eventsSkipped: number
  imageWidgetsAdded: number
  imageWidgetsSkipped: number
  hasBackground: boolean
  /** 本次实际写入的 localStorage 键 */
  localStorageKeys: string[]
}

export interface ExportPreview {
  events: number
  imageWidgets: number
  hasBackground: boolean
  localStorageCount: number
}

export interface ImportSummary {
  events: number
  imageWidgets: number
  hasBackground: boolean
  localStorageKeys: string[]
}

/* ------------------------------- 常量与正则 ------------------------------- */

const EVENT_TYPES = new Set<EventType>(['calendar', 'deadline', 'duration', 'idea'])
const EVENT_STATUSES = new Set<EventStatus>([
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'stateless',
])
const PRIORITIES = new Set<Priority>(['low', 'medium', 'high'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

/* ------------------------------- 导出 ------------------------------- */

function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, value)
}

/** 读取全部用户数据并打包为导出文件（不落盘，由调用方触发下载） */
async function exportData(): Promise<MyMemoExport> {
  const snapshot = await dataTransferRepository.readAll()

  const localStorageData: MyMemoLocalStorageExport = {}
  for (const key of STORAGE_KEY_VALUES) {
    const value = safeGetItem(key)
    if (value !== null) localStorageData[key] = value
  }

  return {
    format: DATA_FORMAT,
    version: DATA_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      indexedDB: {
        events: snapshot.events,
        backgroundSettings: snapshot.backgroundSettings ?? null,
        imageWidgets: snapshot.imageWidgets,
      },
      localStorage: localStorageData,
    },
  }
}

/** 导出文件下载文件名：mymemo-export-YYYYMMDD-HHmmss.json */
function exportFileName(): string {
  return `mymemo-export-${dayjs().format('YYYYMMDD-HHmmss')}.json`
}

/** 触发浏览器下载一个 JSON 文件（blob + 临时 a 标签，不产生网络请求） */
function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 导出前预览：当前各数据源各有多少内容 */
async function getExportPreview(): Promise<ExportPreview> {
  const snapshot = await dataTransferRepository.readAll()
  let localStorageCount = 0
  for (const key of STORAGE_KEY_VALUES) {
    if (safeGetItem(key) !== null) localStorageCount += 1
  }
  return {
    events: snapshot.events.length,
    imageWidgets: snapshot.imageWidgets.length,
    hasBackground: !!snapshot.backgroundSettings,
    localStorageCount,
  }
}

/* ------------------------------- 校验 ------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateEvent(event: unknown, index: number): string {
  if (!isRecord(event)) return `events[${index}] 必须是对象`
  if (typeof event.id !== 'string' || !event.id) return `events[${index}].id 缺失或非法`
  if (typeof event.title !== 'string') return `events[${index}].title 必须为字符串`
  if (typeof event.created_at !== 'string' || !event.created_at)
    return `events[${index}].created_at 缺失`
  if (typeof event.updated_at !== 'string' || !event.updated_at)
    return `events[${index}].updated_at 缺失`
  if (typeof event.notes !== 'string') return `events[${index}].notes 必须为字符串`
  if (!Array.isArray(event.tags) || !event.tags.every((t) => typeof t === 'string'))
    return `events[${index}].tags 必须为字符串数组`

  if (typeof event.type !== 'string' || !EVENT_TYPES.has(event.type as EventType))
    return `events[${index}].type 非法：${String(event.type)}`

  switch (event.type) {
    case 'calendar':
      if (typeof event.event_date !== 'string' || !DATE_RE.test(event.event_date))
        return `events[${index}].event_date 格式非法（应为 YYYY-MM-DD）`
      if (typeof event.all_day !== 'boolean')
        return `events[${index}].all_day 必须为布尔值`
      if (typeof event.event_time !== 'string' || !TIME_RE.test(event.event_time))
        return `events[${index}].event_time 格式非法（应为 HH:mm）`
      if (event.duration_min !== null && typeof event.duration_min !== 'number')
        return `events[${index}].duration_min 必须为数字或 null`
      break
    case 'deadline':
      if (typeof event.due_date !== 'string' || !dayjs(event.due_date).isValid())
        return `events[${index}].due_date 非法日期`
      if (typeof event.priority !== 'string' || !PRIORITIES.has(event.priority as Priority))
        return `events[${index}].priority 非法`
      break
    case 'duration':
      if (typeof event.start_date !== 'string' || !DATE_RE.test(event.start_date))
        return `events[${index}].start_date 格式非法（应为 YYYY-MM-DD）`
      if (
        event.end_date !== null &&
        event.end_date !== undefined &&
        (typeof event.end_date !== 'string' || !DATE_RE.test(event.end_date))
      )
        return `events[${index}].end_date 格式非法（应为 YYYY-MM-DD 或 null）`
      if (event.color !== undefined && typeof event.color !== 'string')
        return `events[${index}].color 必须为字符串`
      break
    case 'idea':
      if (typeof event.archived !== 'boolean')
        return `events[${index}].archived 必须为布尔值`
      if (event.content !== undefined && typeof event.content !== 'string')
        return `events[${index}].content 必须为字符串`
      break
  }

  // idea 不使用 status；其余类型必须带合法状态
  if (event.type !== 'idea') {
    if (typeof event.status !== 'string' || !EVENT_STATUSES.has(event.status as EventStatus))
      return `events[${index}].status 非法`
  }

  return ''
}

function validateBackground(background: unknown): string {
  if (background === null) return ''
  if (!isRecord(background)) return 'data.indexedDB.backgroundSettings 必须是对象或 null'
  if (background.id !== undefined && background.id !== 'default')
    return 'data.indexedDB.backgroundSettings.id 必须为 "default"'

  const numericKeys = [
    'bgOffsetX',
    'bgOffsetY',
    'bgScale',
    'bgImageOpacity',
    'bgImageBlur',
    'bgMaskOpacity',
    'bgOrbOpacity',
  ]
  for (const key of numericKeys) {
    if (typeof background[key] !== 'number')
      return `data.indexedDB.backgroundSettings.${key} 必须为数字`
  }
  if (background.wallpaperDataUrl !== undefined && typeof background.wallpaperDataUrl !== 'string')
    return 'data.indexedDB.backgroundSettings.wallpaperDataUrl 必须为字符串'
  if (background.updatedAt !== undefined && typeof background.updatedAt !== 'string')
    return 'data.indexedDB.backgroundSettings.updatedAt 必须为字符串'
  return ''
}

function validateImageWidget(record: unknown, index: number): string {
  if (!isRecord(record)) return `imageWidgets[${index}] 必须是对象`
  if (typeof record.id !== 'string' || !record.id) return `imageWidgets[${index}].id 缺失`
  if (typeof record.dataUrl !== 'string' || !record.dataUrl.startsWith('data:'))
    return `imageWidgets[${index}].dataUrl 非法`
  if (typeof record.created_at !== 'string') return `imageWidgets[${index}].created_at 缺失`
  if (typeof record.updated_at !== 'string') return `imageWidgets[${index}].updated_at 缺失`
  return ''
}

function validateLocalStorage(localStorageData: unknown): string {
  if (!isRecord(localStorageData)) return 'data.localStorage 必须是对象'
  for (const [key, value] of Object.entries(localStorageData)) {
    if (!isKnownStorageKey(key)) return `data.localStorage 包含未知键：${key}`
    if (typeof value !== 'string') return `data.localStorage.${key} 必须为字符串`
  }
  return ''
}

/**
 * 导出文件整体校验。返回空串表示通过；否则返回第一条错误信息。
 * 任何一项不通过，调用方都不得执行任何写入。
 */
function validateExport(payload: unknown): string {
  if (!isRecord(payload)) return '文件根节点必须是 JSON 对象'
  if (payload.format !== DATA_FORMAT) return '不是 MYMEMO 导出文件（format 不匹配）'
  if (typeof payload.version !== 'number' || !Number.isInteger(payload.version) || payload.version < 1)
    return 'version 非法'
  if (payload.version > DATA_FORMAT_VERSION)
    return `文件版本 ${payload.version} 高于当前支持版本 ${DATA_FORMAT_VERSION}，请先升级应用`
  if (payload.exportedAt !== undefined && typeof payload.exportedAt !== 'string')
    return 'exportedAt 非法'

  if (!isRecord(payload.data)) return 'data 缺失或不是对象'
  const { indexedDB } = payload.data
  if (!isRecord(indexedDB)) return 'data.indexedDB 缺失或不是对象'

  if (!Array.isArray(indexedDB.events)) return 'data.indexedDB.events 必须为数组'
  for (let i = 0; i < indexedDB.events.length; i++) {
    const error = validateEvent(indexedDB.events[i], i)
    if (error) return error
  }

  const backgroundError = validateBackground(indexedDB.backgroundSettings)
  if (backgroundError) return backgroundError

  if (!Array.isArray(indexedDB.imageWidgets)) return 'data.indexedDB.imageWidgets 必须为数组'
  for (let i = 0; i < indexedDB.imageWidgets.length; i++) {
    const error = validateImageWidget(indexedDB.imageWidgets[i], i)
    if (error) return error
  }

  return validateLocalStorage(payload.data.localStorage)
}

/* ------------------------------- 版本迁移 ------------------------------- */

type Migration = (payload: MyMemoExport) => MyMemoExport

/**
 * 迁移注册表：version N → N+1 的迁移脚本。
 * 未来数据模型变化时，新增 DATA_FORMAT_VERSION+1 并在本表补一条迁移即可，
 * 旧文件导入时会被逐级升级到当前版本。
 */
const MIGRATIONS: Record<number, Migration> = {
  // 1 → 2（示例占位，暂未实现）：MIGRATIONS[1] = (p) => ({ ...p, version: 2 })
}

/** 把任意受支持版本的导出文件迁移到当前版本（当前 v1 为恒等操作） */
function migrate(payload: MyMemoExport): MyMemoExport {
  let current = payload
  let version = payload.version
  while (version < DATA_FORMAT_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) {
      throw new Error(
        `暂不支持从版本 ${payload.version} 迁移到当前版本（缺少迁移脚本）`,
      )
    }
    current = step(current)
    version += 1
  }
  return current
}

/* ------------------------------- 导入 ------------------------------- */

/** 文件内按 id 去重，避免同一文件内重复 id 触发主键冲突 */
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id)
      result.push(item)
    }
  }
  return result
}

/** 解析并校验用户选择的文件；失败返回具体原因（此时不得写入任何数据） */
function parseExportFile(
  text: string,
): { ok: true; payload: MyMemoExport } | { ok: false; error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: '文件不是有效的 JSON' }
  }
  const error = validateExport(raw)
  if (error) return { ok: false, error }
  return { ok: true, payload: raw as MyMemoExport }
}

/** 导入文件内容摘要（供 UI 在写入前展示将导入的内容） */
function summarizePayload(payload: MyMemoExport): ImportSummary {
  return {
    events: payload.data.indexedDB.events.length,
    imageWidgets: payload.data.indexedDB.imageWidgets.length,
    hasBackground: !!payload.data.indexedDB.backgroundSettings,
    localStorageKeys: Object.keys(payload.data.localStorage),
  }
}

/**
 * 执行导入。必须在 parseExportFile 校验通过后调用。
 *
 * 策略：
 *  · overwrite（覆盖）：events / imageWidgets 整体替换；背景按文件内容写入或清空。
 *  · merge（合并，默认）：events / imageWidgets 按 id 去重，只补入不存在的记录；
 *                        背景仅在文件含背景时写入（文件无背景则保持现有）；localStorage 键仅在文件包含时覆盖。
 *  localStorage 均为单值设置，两种策略下对「文件包含的键」都采用覆盖。
 */
async function importData(
  payload: MyMemoExport,
  strategy: ImportStrategy,
): Promise<ImportResult> {
  const migrated = migrate(payload)

  const events = dedupeById(migrated.data.indexedDB.events)
  const imageWidgets = dedupeById(migrated.data.indexedDB.imageWidgets)
  const rawBackground = migrated.data.indexedDB.backgroundSettings
  const background: BackgroundSettings | undefined = rawBackground
    ? {
        ...rawBackground,
        id: 'default',
        updatedAt: rawBackground.updatedAt ?? new Date().toISOString(),
      }
    : undefined

  let eventsAdded = events.length
  let eventsSkipped = 0
  let imageWidgetsAdded = imageWidgets.length
  let imageWidgetsSkipped = 0

  if (strategy === 'overwrite') {
    await dataTransferRepository.replaceAll({ events, backgroundSettings: background, imageWidgets })
  } else {
    // 合并模式：events / imageWidgets / 背景在同一个事务内完成（原子），
    // 仅当文件包含背景时才写入，避免误清现有背景。
    const merged = await dataTransferRepository.mergeAll({
      events,
      backgroundSettings: background,
      imageWidgets,
    })
    eventsAdded = merged.eventsAdded
    eventsSkipped = merged.eventsSkipped
    imageWidgetsAdded = merged.imageWidgetsAdded
    imageWidgetsSkipped = merged.imageWidgetsSkipped
  }

  // localStorage：仅写入文件包含的已知键（不删除文件未涉及的键）
  const localStorageKeys: string[] = []
  for (const [key, value] of Object.entries(migrated.data.localStorage)) {
    if (typeof value === 'string' && isKnownStorageKey(key)) {
      safeSetItem(key, value)
      localStorageKeys.push(key)
    }
  }

  return {
    strategy,
    eventsAdded,
    eventsSkipped,
    imageWidgetsAdded,
    imageWidgetsSkipped,
    hasBackground: !!background,
    localStorageKeys,
  }
}

/* ------------------------------- 导出 API ------------------------------- */

export const dataTransferService = {
  exportData,
  exportFileName,
  downloadJson,
  getExportPreview,
  parseExportFile,
  summarizePayload,
  importData,
}

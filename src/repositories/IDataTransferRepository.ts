import type { BackgroundSettings, ImageWidgetRecord } from '@/db/database'
import type { TimeEvent } from '@/types/event'

/**
 * 数据导入 / 导出 Repository 接口。
 * 负责跨表整体读写（readAll / replaceAll / mergeAll），与逐条 CRUD 的
 * IEventRepository / IBackgroundRepository / IImageWidgetRepository 分工：
 * 单条业务操作走各自的 Repository；「整体备份 / 恢复」走本接口。
 */
export interface DataTransferSnapshot {
  events: TimeEvent[]
  backgroundSettings: BackgroundSettings | undefined
  imageWidgets: ImageWidgetRecord[]
}

export interface MergeResult {
  /** 实际写入的新记录数 */
  eventsAdded: number
  /** 因 id 已存在而跳过的记录数 */
  eventsSkipped: number
  imageWidgetsAdded: number
  imageWidgetsSkipped: number
  /** 合并模式下是否写入了背景 */
  hasBackground: boolean
}

export interface IDataTransferRepository {
  /** 读取全部用户数据（三个表） */
  readAll(): Promise<DataTransferSnapshot>
  /** 覆盖模式：清空三个表后整体写入（单事务，要么全成要么全不） */
  replaceAll(snapshot: DataTransferSnapshot): Promise<void>
  /**
   * 合并模式：只写入 id 尚不存在的记录（events / imageWidgets 按 id 去重）；
   * 背景仅在文件包含时写入（文件无背景则保持现有）。
   * 三个表在同一个事务内完成，任何一步失败整体回滚，不会出现「半导入」状态。
   */
  mergeAll(snapshot: DataTransferSnapshot): Promise<MergeResult>
}

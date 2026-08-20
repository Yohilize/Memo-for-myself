import type { ImageWidgetRecord } from '@/db/database'

/**
 * ImageWidget Repository 接口：Dashboard 图片小组件（裁剪后图片）的持久化读写。
 * UI / Store 依赖此接口，不关心底层是 IndexedDB 还是远程 API。
 * 未来切换到动态后端时只需要新增一个实现类即可。
 */
export interface IImageWidgetRepository {
  /** 读取全部图片组件记录（按创建时间倒序） */
  getAll(): Promise<ImageWidgetRecord[]>
  /** 读取单条图片组件记录；不存在时返回 undefined */
  getById(id: string): Promise<ImageWidgetRecord | undefined>
  /** 新增一条图片组件记录 */
  create(record: ImageWidgetRecord): Promise<string>
  /** 删除一条图片组件记录（连同其图片数据一起清理） */
  delete(id: string): Promise<void>
}
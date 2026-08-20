import { db, type ImageWidgetRecord } from '@/db/database'
import type { IImageWidgetRepository } from './IImageWidgetRepository'

/**
 * 基于 IndexedDB (Dexie) 的图片小组件 Repository 实现。
 * 图片以 base64 DataURL 持久化（与背景壁纸同一方案），可跨刷新存活。
 */
export class DexieImageWidgetRepository implements IImageWidgetRepository {
  async getAll(): Promise<ImageWidgetRecord[]> {
    const rows = await db.imageWidgets.orderBy('created_at').reverse().toArray()
    return rows
  }

  async getById(id: string): Promise<ImageWidgetRecord | undefined> {
    return db.imageWidgets.get(id)
  }

  async create(record: ImageWidgetRecord): Promise<string> {
    await db.imageWidgets.add(record)
    return record.id
  }

  async delete(id: string): Promise<void> {
    await db.imageWidgets.delete(id)
  }
}

export const imageWidgetRepository = new DexieImageWidgetRepository()
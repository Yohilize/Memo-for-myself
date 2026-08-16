import { db, type BackgroundSettings } from '@/db/database'
import type { IBackgroundRepository } from './IBackgroundRepository'

/**
 * 基于 IndexedDB (Dexie) 的固定背景 Repository 实现。
 * 单条 KV 存储（id 恒为 'default'），容量与写入延迟都优于 localStorage / JSON 文件。
 */
export class DexieBackgroundRepository implements IBackgroundRepository {
  async get(): Promise<BackgroundSettings | undefined> {
    return db.backgroundSettings.get('default')
  }

  async save(
    settings: Omit<BackgroundSettings, 'id' | 'updatedAt'>,
  ): Promise<BackgroundSettings> {
    const record: BackgroundSettings = {
      id: 'default',
      ...settings,
      updatedAt: new Date().toISOString(),
    }
    // Dexie.put = 存在则更新，不存在则插入（upsert），保证单条 KV 语义
    await db.backgroundSettings.put(record)
    return record
  }

  async clear(): Promise<void> {
    await db.backgroundSettings.delete('default')
  }
}

export const backgroundRepository = new DexieBackgroundRepository()

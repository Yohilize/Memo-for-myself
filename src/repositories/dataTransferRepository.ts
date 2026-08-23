import { db } from '@/db/database'
import type {
  IDataTransferRepository,
  DataTransferSnapshot,
  MergeResult,
} from './IDataTransferRepository'

/**
 * 基于 IndexedDB (Dexie) 的数据导入 / 导出 Repository 实现。
 * 所有写入都包在单事务里：任何一步失败整体回滚，避免出现"半导入"状态。
 */
export class DexieDataTransferRepository implements IDataTransferRepository {
  async readAll(): Promise<DataTransferSnapshot> {
    const [events, backgroundSettings, imageWidgets] = await Promise.all([
      db.events.toArray(),
      db.backgroundSettings.get('default'),
      db.imageWidgets.toArray(),
    ])
    return { events, backgroundSettings, imageWidgets }
  }

  async replaceAll(snapshot: DataTransferSnapshot): Promise<void> {
    await db.transaction('rw', db.events, db.backgroundSettings, db.imageWidgets, async () => {
      await db.events.clear()
      if (snapshot.events.length > 0) await db.events.bulkAdd(snapshot.events)

      if (snapshot.backgroundSettings) {
        await db.backgroundSettings.put(snapshot.backgroundSettings)
      } else {
        await db.backgroundSettings.clear()
      }

      await db.imageWidgets.clear()
      if (snapshot.imageWidgets.length > 0) await db.imageWidgets.bulkAdd(snapshot.imageWidgets)
    })
  }

  async mergeAll(snapshot: DataTransferSnapshot): Promise<MergeResult> {
    return db.transaction('rw', db.events, db.backgroundSettings, db.imageWidgets, async () => {
      const eventKeys = new Set<string>(await db.events.toCollection().primaryKeys())
      const incomingEvents = snapshot.events.filter((event) => !eventKeys.has(event.id))
      if (incomingEvents.length > 0) await db.events.bulkAdd(incomingEvents)

      const imageKeys = new Set<string>(await db.imageWidgets.toCollection().primaryKeys())
      const incomingImages = snapshot.imageWidgets.filter((record) => !imageKeys.has(record.id))
      if (incomingImages.length > 0) await db.imageWidgets.bulkAdd(incomingImages)

      let hasBackground = false
      if (snapshot.backgroundSettings) {
        await db.backgroundSettings.put(snapshot.backgroundSettings)
        hasBackground = true
      }

      return {
        eventsAdded: incomingEvents.length,
        eventsSkipped: snapshot.events.length - incomingEvents.length,
        imageWidgetsAdded: incomingImages.length,
        imageWidgetsSkipped: snapshot.imageWidgets.length - incomingImages.length,
        hasBackground,
      }
    })
  }
}

export const dataTransferRepository = new DexieDataTransferRepository()

import { db } from '@/db/database'
import type { IEventRepository } from './IEventRepository'
import type { TimeEvent, EventType } from '@/types/event'

/**
 * 基于 IndexedDB (Dexie) 的 Repository 实现。
 * 当前阶段唯一的数据源。
 */
export class DexieEventRepository implements IEventRepository {
  async getAll(): Promise<TimeEvent[]> {
    return db.events.orderBy('created_at').reverse().toArray()
  }

  async getById(id: string): Promise<TimeEvent | undefined> {
    return db.events.get(id)
  }

  async getByType(type: EventType): Promise<TimeEvent[]> {
    const results = await db.events.where('type').equals(type).sortBy('created_at')
    return results.reverse()
  }

  async create(event: TimeEvent): Promise<string> {
    await db.events.add(event)
    return event.id
  }

  async update(id: string, patch: Partial<TimeEvent>): Promise<void> {
    await db.events.update(id, patch)
  }

  async delete(id: string): Promise<void> {
    await db.events.delete(id)
  }

  async count(): Promise<number> {
    return db.events.count()
  }
}

export const eventRepository = new DexieEventRepository()

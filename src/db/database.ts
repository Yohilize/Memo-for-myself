import Dexie, { type Table } from 'dexie'
import type { TimeEvent } from '@/types/event'

/**
 * Dexie 数据库定义。
 * 仅在 db/ 层内部使用，不对外暴露。
 * 上层通过 Repository 访问数据，不直接 import db。
 */
class MymemoDatabase extends Dexie {
  events!: Table<TimeEvent, string>

  constructor() {
    super('mymemo')

    this.version(1).stores({
      // 主键 id，type 和 created_at 建索引用于查询
      events: 'id, type, status, created_at, updated_at',
    })
  }
}

export const db = new MymemoDatabase()

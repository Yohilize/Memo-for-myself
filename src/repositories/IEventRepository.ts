import type { TimeEvent, EventType } from '@/types/event'

/**
 * Event Repository 接口。
 * Service 层依赖此接口，不关心底层是 IndexedDB 还是远程 API。
 * 未来新增 ApiEventRepository 实现此接口即可完成数据源切换。
 */
export interface IEventRepository {
  getAll(): Promise<TimeEvent[]>
  getById(id: string): Promise<TimeEvent | undefined>
  getByType(type: EventType): Promise<TimeEvent[]>
  create(event: TimeEvent): Promise<string>
  update(id: string, patch: Partial<TimeEvent>): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}

import dayjs from 'dayjs'
import type { TimeEvent, EventType } from '@/types/event'

export interface DateIndicator {
  /** 该日期是否至少有 1 个事件 */
  hasEvent: boolean
  /** 每种类型的事件数量（≥ 1 才显示该类型的小圆点） */
  byType: Record<EventType, number>
}

/**
 * 给定一个事件列表，返回 { 'YYYY-MM-DD': indicator } 的字典。
 * 规则：
 *  - CalendarEvent → event_date
 *  - DeadlineEvent → due_date（取日期部分）
 *  - DurationEvent → 从 start_time 到 end_time 跨的每一天，都算有事件
 *  - IdeaEvent     → created_at（取日期部分），挂在创建日做轻量提示
 */
export function mapEventsToDateIndicators(
  events: TimeEvent[],
): Record<string, DateIndicator> {
  const map: Record<string, DateIndicator> = {}

  for (const e of events) {
    const dates = eventDates(e)
    for (const d of dates) {
      if (!map[d]) {
        map[d] = {
          hasEvent: true,
          byType: { calendar: 0, deadline: 0, duration: 0, idea: 0 },
        }
      }
      map[d].byType[e.type] += 1
    }
  }
  return map
}

function eventDates(e: TimeEvent): string[] {
  switch (e.type) {
    case 'calendar':
      return [e.event_date]
    case 'deadline': {
      const d = dayjs(e.due_date)
      return d.isValid() ? [d.format('YYYY-MM-DD')] : []
    }
    case 'duration': {
      const start = dayjs(e.start_time)
      const end = dayjs(e.end_time)
      if (!start.isValid() || !end.isValid()) return []
      const result: string[] = []
      let cur = start.startOf('day')
      const stop = end.startOf('day')
      // 最多跨 366 天，避免异常数据死循环
      let guard = 0
      while (cur.isBefore(stop) || cur.isSame(stop, 'day')) {
        result.push(cur.format('YYYY-MM-DD'))
        cur = cur.add(1, 'day')
        if (++guard > 366) break
      }
      return result
    }
    case 'idea': {
      const d = dayjs(e.created_at)
      return d.isValid() ? [d.format('YYYY-MM-DD')] : []
    }
  }
}

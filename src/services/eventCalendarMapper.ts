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
 *  - IdeaEvent     → 不进入日历（数据映射层过滤，不产生任何日期指示器/事件标记/事件点）
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

/**
 * 返回「落在某一天」内的事件列表，用于月历下方「当天事件」展示。
 *
 * 规则（严格对应需求）：
 *  - CalendarEvent  → selectedDate === event_date（YYYY-MM-DD 精确相等）
 *  - DeadlineEvent  → selectedDate === due_date 的日期部分
 *  - DurationEvent  → selectedDate 落在 [start_time, end_time] 区间（按天比较，两端都含）
 *  - IdeaEvent      → 当前没有明确日期字段 → 不显示（需求第 7 条）
 *
 * 返回顺序不做强制排序，UI 层可自行按事件类型与时间排序。
 */
export function filterEventsForDay(
  events: TimeEvent[],
  dayKey: string,
): TimeEvent[] {
  const day = dayjs(dayKey)
  if (!day.isValid()) return []
  const start = day.startOf('day')
  const end = day.endOf('day')

  return events.filter((e): boolean => {
    switch (e.type) {
      case 'calendar':
        return e.event_date === dayKey
      case 'deadline': {
        const d = dayjs(e.due_date)
        return d.isValid() && d.isSame(start, 'day')
      }
      case 'duration': {
        const s = dayjs(e.start_time)
        const t = dayjs(e.end_time)
        if (!s.isValid() || !t.isValid()) return false
        // DurationEvent：start_time ~ end_time 跨越的每一天都命中
        return !(end.isBefore(s, 'day') || start.isAfter(t, 'day'))
      }
      case 'idea':
        // IdeaEvent 没有明确日期字段 → 不显示在当天列表
        return false
    }
  })
}

/**
 * 给「当天事件列表」用的排序键：按时间升序（没有明确时间的排到最后）。
 * 返回字符串，可直接用 <arr>.sort((a, b) => compareKey(a, dayKey).localeCompare(compareKey(b, dayKey)))
 * 格式：'HH:mm' 或 '99:99'（无时间的 Deadline、跨天 Duration 当天），保证排在末尾。
 */
export function dayEventTimeLabel(
  e: TimeEvent,
  dayKey: string,
): string {
  switch (e.type) {
    case 'calendar':
      return e.all_day ? '全天' : e.event_time || ''
    case 'deadline': {
      const d = dayjs(e.due_date)
      return d.isValid() && (d.hour() !== 0 || d.minute() !== 0)
        ? d.format('HH:mm')
        : '截止'
    }
    case 'duration': {
      const s = dayjs(e.start_time)
      const t = dayjs(e.end_time)
      const day = dayjs(dayKey)
      if (!s.isValid() || !t.isValid()) return '时段'
      const sameStart = s.isSame(day, 'day')
      const sameEnd = t.isSame(day, 'day')
      if (sameStart && sameEnd) return `${s.format('HH:mm')}–${t.format('HH:mm')}`
      if (sameStart) return `${s.format('HH:mm')}–`
      if (sameEnd) return `–${t.format('HH:mm')}`
      return '全天' // 跨天但当天在中间
    }
    case 'idea':
      return ''
  }
}

/**
 * 与 dayEventTimeLabel 对应的内部比较键：保证时间在前的排在前面。
 * '全天'、'截止'、'时段' 等非具体时间的文本映射到 24:00+ 区间，确保排在末尾。
 */
export function dayEventSortKey(e: TimeEvent, dayKey: string): string {
  switch (e.type) {
    case 'calendar':
      return e.all_day ? '99:99' : e.event_time || '99:99'
    case 'deadline': {
      const d = dayjs(e.due_date)
      return d.isValid() && (d.hour() !== 0 || d.minute() !== 0)
        ? d.format('HH:mm')
        : '99:99'
    }
    case 'duration': {
      const s = dayjs(e.start_time)
      const day = dayjs(dayKey)
      if (!s.isValid()) return '99:99'
      return s.isSame(day, 'day') ? s.format('HH:mm') : '00:00'
    }
    case 'idea':
      return '99:99'
  }
}

/**
 * 返回一个事件「影响到」哪些日期（用于 indicator 打点，与 filterEventsForDay 规则对齐）。
 * 注意：IdeaEvent 不进入日历 —— 灵感不参与时间管理，不产生日期指示器 / 事件标记 / 事件点，
 * 所以这里为其返回空列表（数据映射层过滤，而非 CSS 隐藏）。
 */
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
    default:
      // idea：灵感不走时间管理日历，返回空日期列表
      return []
  }
}

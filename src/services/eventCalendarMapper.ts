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
 *  - DurationEvent → 只在开始日期与（若已确定）结束日期打点，不连续覆盖中间日期
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
 *  - DurationEvent  → selectedDate 落在 [start_date, end_date] 区间（按天比较，两端都含）；无 end_date 仅命中开始日期
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

  return events.filter((e): boolean => {
    switch (e.type) {
      case 'calendar':
        return e.event_date === dayKey
      case 'deadline': {
        const d = dayjs(e.due_date)
        return d.isValid() && d.isSame(start, 'day')
      }
      case 'duration': {
        const s = dayjs(e.start_date)
        if (!s.isValid()) return false
        // 无结束日期：仅命中开始日期一方
        if (!e.end_date) return day.isSame(s, 'day')
        const t = dayjs(e.end_date)
        if (!t.isValid()) return false
        // DurationEvent：start_date ~ end_date 跨越的每一天都命中
        return !(day.isBefore(s, 'day') || day.isAfter(t, 'day'))
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
  _dayKey: string,
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
      const s = dayjs(e.start_date)
      if (!s.isValid()) return '时段'
      // 无结束日期：仅开始，未定结束 → 「进行中」
      if (!e.end_date) return '进行中'
      const t = dayjs(e.end_date)
      if (!t.isValid()) return '时段'
      return `${s.format('M月D日')}–${t.format('M月D日')}`
    }
    case 'idea':
      return ''
  }
}

/**
 * 与 dayEventTimeLabel 对应的内部比较键：保证时间在前的排在前面。
 * '全天'、'截止'、'时段' 等非具体时间的文本映射到 24:00+ 区间，确保排在末尾。
 */
export function dayEventSortKey(e: TimeEvent, _dayKey: string): string {
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
      // 时间块为整块活动，排序上始终置顶（无具体时刻）
      const s = dayjs(e.start_date)
      return s.isValid() ? '00:00' : '99:99'
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
      // 未开启「显示时间块」时，时间块不显示连续色块/连续圆点，
      // 只在开始日期与（若已确定）结束日期各打一个点，不覆盖中间日期。
      const start = dayjs(e.start_date)
      if (!start.isValid()) return []
      const dates = [start.format('YYYY-MM-DD')]
      if (e.end_date) {
        const end = dayjs(e.end_date)
        if (end.isValid() && !end.isSame(start, 'day')) {
          dates.push(end.format('YYYY-MM-DD'))
        }
      }
      return dates
    }
    default:
      // idea：灵感不走时间管理日历，返回空日期列表
      return []
  }
}

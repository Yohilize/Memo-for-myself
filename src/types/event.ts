/**
 * MYMEMO 数据模型
 * 使用 TypeScript 可辨识联合（Discriminated Union）。
 * 运行时为普通 JSON 对象，无类/继承开销。
 */

export type EventType = 'calendar' | 'deadline' | 'duration' | 'idea'

export type EventStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export type Priority = 'low' | 'medium' | 'high'

/** 所有事件类型共享的基础字段（不含任务状态） */
export interface EventBase {
  id: string
  title: string
  notes: string
  tags: string[]
  created_at: string
  updated_at: string
}

/**
 * 参与任务跟踪的事件基类：calendar / deadline / duration。
 * 仅这三类拥有 status（待办/进行中/已完成/已取消）。
 * Idea 不继承此接口 → 从数据层彻底区分「灵感」与「任务」。
 */
export interface StatusEventBase extends EventBase {
  status: EventStatus
}

/** 日历事件：定点日期+时间 */
export interface CalendarEvent extends StatusEventBase {
  type: 'calendar'
  event_date: string // 'YYYY-MM-DD'
  all_day: boolean
  event_time: string // 'HH:mm'（all_day 为 true 时忽略）
  duration_min: number | null
}

/** Deadline：有截止日期 */
export interface DeadlineEvent extends StatusEventBase {
  type: 'deadline'
  due_date: string // ISO 8601
  priority: Priority
}

/** Duration：时间块，有开始和结束 */
export interface DurationEvent extends StatusEventBase {
  type: 'duration'
  start_time: string // ISO 8601
  end_time: string // ISO 8601
}

/** Idea：灵感记录（无任务状态，仅靠 archived 归档/取消归档管理） */
export interface IdeaEvent extends EventBase {
  type: 'idea'
  content?: string
  archived: boolean
}

/** 联合类型 */
export type TimeEvent = CalendarEvent | DeadlineEvent | DurationEvent | IdeaEvent

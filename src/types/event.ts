/**
 * MYMEMO 数据模型
 * 使用 TypeScript 可辨识联合（Discriminated Union）。
 * 运行时为普通 JSON 对象，无类/继承开销。
 */

export type EventType = 'calendar' | 'deadline' | 'duration' | 'idea'

export type EventStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'stateless'
// 说明：stateless = 「无状态」，calendar / deadline / duration 三类任务型事件均支持。
// 它表示纯事件/事项记录，不参与待办/进行中/已完成，不受自动状态更新影响，亦区别于已取消。
// idea 为独立类型，不使用 status；deadline 的无状态同样成立，但其自动状态更新暂不实现。

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

/**
 * Duration：时间块，表示一个跨日期的区间。
 *  - start_date：开始日期（必填）
 *  - end_date：结束日期；null 表示「已开始、暂定结束日期」的开放区间
 *  - color：日历中色块的可视化颜色（hex），仅影响展示，不进入业务逻辑
 */
export interface DurationEvent extends StatusEventBase {
  type: 'duration'
  start_date: string // 'YYYY-MM-DD'
  end_date: string | null // 'YYYY-MM-DD'；null = 未知结束日期
  color?: string // 色块颜色（hex）
}

/** Idea：灵感记录（无任务状态，仅靠 archived 归档/取消归档管理） */
export interface IdeaEvent extends EventBase {
  type: 'idea'
  content?: string
  archived: boolean
}

/** 联合类型 */
export type TimeEvent = CalendarEvent | DeadlineEvent | DurationEvent | IdeaEvent

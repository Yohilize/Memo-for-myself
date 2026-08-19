import type {
  CalendarEvent,
  DeadlineEvent,
  DurationEvent,
  IdeaEvent,
  EventStatus,
  Priority,
} from '@/types/event'

/**
 * Service 层的创建输入类型。
 * 调用方不需要提供 id、created_at、updated_at，由 service 自动生成。
 */

export interface CreateCalendarInput {
  type: 'calendar'
  title: string
  notes?: string
  tags?: string[]
  status?: EventStatus
  event_date: string
  all_day?: boolean
  event_time?: string
  duration_min?: number | null
}

export interface CreateDeadlineInput {
  type: 'deadline'
  title: string
  notes?: string
  tags?: string[]
  status?: EventStatus
  due_date: string
  priority?: Priority
}

export interface CreateDurationInput {
  type: 'duration'
  title: string
  notes?: string
  tags?: string[]
  status?: EventStatus
  start_date: string
  /** 结束日期；不传或传 null 表示「已开始、未知结束」的开放区块 */
  end_date?: string | null
  /** 日历色块颜色（hex）；不传则用默认色 */
  color?: string
}

export interface CreateIdeaInput {
  type: 'idea'
  title: string
  notes?: string
  content?: string
  tags?: string[]
  archived?: boolean
}

export type CreateEventInput =
  | CreateCalendarInput
  | CreateDeadlineInput
  | CreateDurationInput
  | CreateIdeaInput

/** 更新输入：所有字段可选，但 type 不可更改 */
export type UpdateEventInput = Partial<Omit<CalendarEvent, 'id' | 'type'>> &
  Partial<Omit<DeadlineEvent, 'id' | 'type'>> &
  Partial<Omit<DurationEvent, 'id' | 'type'>> &
  Partial<Omit<IdeaEvent, 'id' | 'type'>>

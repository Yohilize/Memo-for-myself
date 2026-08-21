import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import { eventRepository } from '@/repositories'
import type { TimeEvent, EventType, EventStatus } from '@/types/event'
import type { CreateEventInput, UpdateEventInput } from './eventTypes'

/**
 * 状态推导需要的最小字段集（calendar / deadline / duration 均满足）。
 * idea 不参与，调用侧用 type !== 'idea' 提前排除。
 */
export type StatusSource = {
  type: EventType
  status: EventStatus
  event_date?: string | null
  start_date?: string | null
  end_date?: string | null
}

/**
 * 由「事件数据 + 当前日期」推导「用于展示/统计的显示状态」。
 * 设计原则：
 *  · 不写回数据库的原始 status —— 每天/随时重算，避免随时间改动持久化数据；
 *  · stateless / completed / cancelled：使用者显式指定，不因日期变化；
 *  · deadline：暂不实现自动更新，沿用用户手动设置的状态；
 *  · calendar / duration：按日期区间推导待办/进行中/已完成。
 */
export function deriveEventDisplayStatus(
  e: StatusSource,
  today: string | Date | dayjs.Dayjs,
): EventStatus {
  const t = dayjs(today).startOf('day')

  // 无状态 / 终止态：使用者显式声明，永不被日期覆盖
  if (e.status === 'stateless' || e.status === 'completed' || e.status === 'cancelled') {
    return e.status
  }

  // deadline：暂不自动更新，沿用手动状态
  if (e.type === 'deadline') return e.status

  if (e.type === 'calendar') {
    const ev = dayjs(e.event_date).startOf('day')
    if (ev.isSame(t, 'day')) return 'in_progress'
    return ev.isAfter(t) ? 'pending' : 'completed'
  }

  if (e.type === 'duration') {
    const start = dayjs(e.start_date).startOf('day')
    if (start.isAfter(t)) return 'pending'
    if (e.end_date) {
      return dayjs(e.end_date).startOf('day').isBefore(t, 'day') ? 'completed' : 'in_progress'
    }
    return 'in_progress' // 无明确结束日期：开始后持续进行中
  }

  return e.status
}

/** 是否计入「待办」：非 idea，且派生状态未完成、非终止、非无状态。 */
export function isTaskPending(e: StatusSource, today: string | Date | dayjs.Dayjs): boolean {
  if (e.type === 'idea') return false
  const s = deriveEventDisplayStatus(e, today)
  return s !== 'stateless' && s !== 'completed' && s !== 'cancelled'
}

/** 是否计入「今日完成」：非 idea，且派生状态为已完成。 */
export function isCompletedToday(e: StatusSource, today: string | Date | dayjs.Dayjs): boolean {
  if (e.type === 'idea') return false
  return deriveEventDisplayStatus(e, today) === 'completed'
}

/** Event Service — 业务逻辑层。
 * 负责 ID 生成、时间戳、默认值填充、基本校验。
 * 不直接操作数据库，通过 Repository 访问。
 */
export const eventService = {
  async getAll(): Promise<TimeEvent[]> {
    return eventRepository.getAll()
  },

  async getById(id: string): Promise<TimeEvent | undefined> {
    return eventRepository.getById(id)
  },

  async getByType(type: EventType): Promise<TimeEvent[]> {
    return eventRepository.getByType(type)
  },

  async create(input: CreateEventInput): Promise<TimeEvent> {
    validateCreateInput(input)

    const now = new Date().toISOString()
    const base = {
      id: uuidv4(),
      title: input.title.trim(),
      notes: input.notes ?? '',
      tags: input.tags ?? [],
      created_at: now,
      updated_at: now,
    }

    let event: TimeEvent

    switch (input.type) {
      case 'calendar':
        // 行程默认「无状态」：纯时间/事件记录，不参与任务进度，除非用户显式选择任务状态
        event = {
          ...base,
          type: 'calendar',
          status: input.status ?? 'stateless',
          event_date: input.event_date,
          all_day: input.all_day ?? false,
          event_time: input.event_time ?? '09:00',
          duration_min: input.duration_min ?? null,
        }
        break
      case 'deadline':
        event = {
          ...base,
          type: 'deadline',
          status: input.status ?? 'pending',
          due_date: input.due_date,
          priority: input.priority ?? 'medium',
        }
        break
      case 'duration':
        event = {
          ...base,
          type: 'duration',
          status: input.status ?? 'pending',
          start_date: input.start_date,
          end_date: input.end_date ?? null,
          color: input.color ?? DEFAULT_DURATION_COLOR,
        }
        break
      case 'idea':
        // idea 不参与任务跟踪：不写入 status，仅归档/取消归档（archived）管理
        event = {
          ...base,
          type: 'idea',
          content: input.content,
          archived: input.archived ?? false,
        }
        break
    }

    await eventRepository.create(event)
    return event
  },

  async update(id: string, patch: UpdateEventInput): Promise<TimeEvent | undefined> {
    const existing = await eventRepository.getById(id)
    if (!existing) return undefined

    const updated = {
      ...patch,
      updated_at: new Date().toISOString(),
    }

    await eventRepository.update(id, updated)
    return eventRepository.getById(id)
  },

  async delete(id: string): Promise<void> {
    await eventRepository.delete(id)
  },

  async count(): Promise<number> {
    return eventRepository.count()
  },
}

function validateCreateInput(input: CreateEventInput): void {
  if (!input.title || !input.title.trim()) {
    throw new Error('title is required')
  }

  if (input.type === 'calendar' && !input.event_date) {
    throw new Error('calendar event requires event_date')
  }

  if (input.type === 'deadline' && !input.due_date) {
    throw new Error('deadline event requires due_date')
  }

  if (input.type === 'duration') {
    if (!input.start_date) {
      throw new Error('duration event requires start_date')
    }
    if (input.end_date && input.end_date < input.start_date) {
      throw new Error('end_date must not be before start_date')
    }
  }
}

/**
 * 时间块默认色块颜色（柔低饱和鼠尾草绿，对应 tokens 的 --color-event-duration）。
 * 仅用于日历可视化，不进入业务逻辑。
 */
export const DEFAULT_DURATION_COLOR = '#8aa388'

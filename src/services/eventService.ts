import { v4 as uuidv4 } from 'uuid'
import { eventRepository } from '@/repositories'
import type { TimeEvent, EventType } from '@/types/event'
import type { CreateEventInput, UpdateEventInput } from './eventTypes'

/**
 * Event Service — 业务逻辑层。
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
        event = {
          ...base,
          type: 'calendar',
          status: input.status ?? 'pending',
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

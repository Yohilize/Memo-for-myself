import { computed, ref, watch } from 'vue'
import { useEventStore } from '@/stores/eventStore'
import { STORAGE_KEYS } from '@/services/storageKeys'
import type { TimeEvent } from '@/types/event'

/**
 * Dashboard「固定事件」多值状态（UI 状态，存 localStorage）。
 *
 * 支持多个固定事件：存储为 JSON 字符串数组；历史单值数据自动兼容迁移。
 * 只经 useEventStore 取真实事件，自身不触碰 IndexedDB（数据库结构不变）。
 */
const STORAGE_KEY = STORAGE_KEYS.dashboardPinnedEvent
const pinnedEventIds = ref(loadPinnedEventIds())

function loadPinnedEventIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === 'string')
      // JSON 引号字符串（历史某版可能存过JSON字符串）
      if (typeof parsed === 'string' && parsed.trim()) return [parsed]
      return []
    } catch {
      // 历史版本：裸字符串单个 id
      return raw.trim() ? [raw] : []
    }
  } catch (_error) {
    return []
  }
}

function persistPinnedEventIds(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    if (ids.length) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch (_error) {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function syncPinnedEvents(events: TimeEvent[]): void {
  const existing = new Set(events.map((e) => e.id))
  const remaining = pinnedEventIds.value.filter((id) => existing.has(id))
  if (remaining.length !== pinnedEventIds.value.length) {
    pinnedEventIds.value = remaining
    persistPinnedEventIds(remaining)
  }
}

export function useDashboardPinnedEvent() {
  const eventStore = useEventStore()

  const pinnedEvents = computed<TimeEvent[]>(() =>
    pinnedEventIds.value
      .map((id) => eventStore.events.find((e) => e.id === id))
      .filter((e) => e !== undefined) as TimeEvent[],
  )

  // Event Store 会响应式替换编辑后的记录、删除被删记录，
  // 该 watcher 使组件在编辑/删除后自愈：移除已不复存在的固定 id。
  watch(
    () => eventStore.events,
    (events) => syncPinnedEvents(events),
    // 不使用 immediate：Dashboard 首次挂载时 Store 可能还没完成异步加载，
    // 不能把 localStorage 中仍然有效的固定 ID 当成“已删除”清掉。
    { deep: true },
  )

  function isEventPinned(eventId: string): boolean {
    return pinnedEventIds.value.includes(eventId)
  }

  function pinEvent(eventId: string): void {
    if (!eventStore.events.some((e) => e.id === eventId)) return
    if (pinnedEventIds.value.includes(eventId)) return
    const next = [...pinnedEventIds.value, eventId]
    pinnedEventIds.value = next
    persistPinnedEventIds(next)
  }

  function unpinEvent(eventId: string): void {
    const next = pinnedEventIds.value.filter((id) => id !== eventId)
    pinnedEventIds.value = next
    persistPinnedEventIds(next)
  }

  function toggleEventPinned(eventId: string): void {
    if (isEventPinned(eventId)) {
      unpinEvent(eventId)
    } else {
      pinEvent(eventId)
    }
  }

  return {
    pinnedEventIds,
    pinnedEvents,
    isEventPinned,
    pinEvent,
    unpinEvent,
    toggleEventPinned,
  }
}
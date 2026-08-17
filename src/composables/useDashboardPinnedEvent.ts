import { computed, ref, watch } from 'vue'
import { useEventStore } from '@/stores/eventStore'
import type { TimeEvent } from '@/types/event'

const STORAGE_KEY = 'mymemo.dashboard.pinned-event.v1'
const pinnedEventId = ref(loadPinnedEventId())

function loadPinnedEventId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch (_error) {
    return null
  }
}

function persistPinnedEventId(id: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (id) {
      window.localStorage.setItem(STORAGE_KEY, id)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch (_error) {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function syncPinnedEvent(events: TimeEvent[]): void {
  if (pinnedEventId.value && !events.some((event) => event.id === pinnedEventId.value)) {
    pinnedEventId.value = null
    persistPinnedEventId(null)
  }
}

export function useDashboardPinnedEvent() {
  const eventStore = useEventStore()

  const pinnedEvent = computed<TimeEvent | null>(() => {
    if (!pinnedEventId.value) return null
    return eventStore.events.find((event) => event.id === pinnedEventId.value) ?? null
  })

  // Event Store replaces edited records and removes deleted records reactively.
  // Keeping this watcher here makes the widget self-healing after either action.
  watch(
    () => eventStore.events,
    (events) => syncPinnedEvent(events),
    // 不使用 immediate：Dashboard 首次挂载时 Store 可能还没完成异步加载，
    // 不能把 localStorage 中仍然有效的固定 ID 当成“已删除”清掉。
    { deep: true },
  )

  function isEventPinned(eventId: string): boolean {
    return pinnedEventId.value === eventId
  }

  function pinEvent(eventId: string): void {
    if (!eventStore.events.some((event) => event.id === eventId)) return
    pinnedEventId.value = eventId
    persistPinnedEventId(eventId)
  }

  function unpinEvent(): void {
    pinnedEventId.value = null
    persistPinnedEventId(null)
  }

  function toggleEventPinned(eventId: string): void {
    if (isEventPinned(eventId)) {
      unpinEvent()
    } else {
      pinEvent(eventId)
    }
  }

  return {
    pinnedEventId,
    pinnedEvent,
    isEventPinned,
    pinEvent,
    unpinEvent,
    toggleEventPinned,
  }
}

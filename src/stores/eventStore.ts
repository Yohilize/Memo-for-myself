import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { eventService } from '@/services'
import type { CreateEventInput, UpdateEventInput } from '@/services'
import type { TimeEvent, EventType } from '@/types/event'

export const useEventStore = defineStore('events', () => {
  const events = ref<TimeEvent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const eventsByType = computed(() => {
    const map: Record<EventType, TimeEvent[]> = {
      calendar: [],
      deadline: [],
      duration: [],
      idea: [],
    }
    for (const e of events.value) {
      map[e.type].push(e)
    }
    return map
  })

  async function loadAll() {
    loading.value = true
    error.value = null
    try {
      events.value = await eventService.getAll()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load events'
    } finally {
      loading.value = false
    }
  }

  async function create(input: CreateEventInput) {
    error.value = null
    try {
      const event = await eventService.create(input)
      events.value.unshift(event)
      return event
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create event'
      throw e
    }
  }

  async function update(id: string, patch: UpdateEventInput) {
    error.value = null
    try {
      const updated = await eventService.update(id, patch)
      if (updated) {
        const idx = events.value.findIndex((e) => e.id === id)
        if (idx !== -1) events.value[idx] = updated
      }
      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update event'
      throw e
    }
  }

  async function remove(id: string) {
    error.value = null
    try {
      await eventService.delete(id)
      events.value = events.value.filter((e) => e.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete event'
      throw e
    }
  }

  return {
    events,
    loading,
    error,
    eventsByType,
    loadAll,
    create,
    update,
    remove,
  }
})

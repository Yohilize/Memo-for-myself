import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useEventStore } from '@/stores/eventStore'
import type { EventType, TimeEvent } from '@/types/event'
import type { CreateEventInput, UpdateEventInput } from '@/services/eventTypes'

/**
 * 全局「新增 / 编辑事件窗口」store —— 全项目唯一事件窗口的单例状态宿主。
 *
 * 架构目的：此前 EventForm 被 Dashboard / Calendar / Events / Ideas 各处分别 <EventForm> 实例化，
 * 状态互不共享。现统一为一个全局窗口：由 App.vue 挂载唯一 <EventForm>，
 * 所有入口只调用 openCreate / openEdit 传入上下文，窗口怎样打开、保存、删除都由本 store + EventForm 承担。
 *
 * 数据链路不变：submitCreate / submitUpdate / remove 仍走 useEventStore → Service → Repository → IndexedDB，
 * Pinia 响应式自动刷新各 widget（响应式同步机制保持不变）。
 */
export const useEventWindowStore = defineStore('eventWindow', () => {
  const eventStore = useEventStore()

  // —— 窗口可见性与模式 —— //
  const visible = ref(false)
  const mode = ref<'create' | 'edit'>('create')

  // —— 创建上下文 —— //
  const defaultType = ref<EventType>('calendar')
  const defaultDate = ref<string>('')

  // —— 编辑上下文：仅存 eventId，真实事件按 id 从 Store 实时解析 —— //
  const eventId = ref<string | null>(null)

  /** 编辑模式下的真实事件：按 eventId 从最新 Store 事件解析（始终拿到最新 Event）。 */
  const editingEvent = computed<TimeEvent | null>(() => {
    if (mode.value !== 'edit' || !eventId.value) return null
    return eventStore.events.find((e) => e.id === eventId.value) ?? null
  })

  // —— 删除确认（EventForm 底部删除按钮） —— //
  const deleteTarget = ref<TimeEvent | null>(null)

  function openCreate(opts: { defaultType?: EventType; defaultDate?: string } = {}): void {
    mode.value = 'create'
    eventId.value = null
    deleteTarget.value = null
    defaultType.value = opts.defaultType ?? 'calendar'
    defaultDate.value = opts.defaultDate ?? ''
    visible.value = true
  }

  function openEdit(id: string): void {
    mode.value = 'edit'
    eventId.value = id
    deleteTarget.value = null
    defaultType.value = 'calendar'
    defaultDate.value = ''
    visible.value = true
  }

  function close(): void {
    visible.value = false
    eventId.value = null
  }

  /** 提交新增：成功才关闭，失败保持窗口打开（错误文案已在 eventStore.error）。 */
  async function submitCreate(input: CreateEventInput): Promise<void> {
    try {
      await eventStore.create(input)
      visible.value = false
    } catch (_err) {
      /* 忽略，eventStore.error 已持有文案 */
    }
  }

  /** 提交编辑：成功才关闭。 */
  async function submitUpdate(id: string, patch: UpdateEventInput): Promise<void> {
    try {
      await eventStore.update(id, patch)
      visible.value = false
    } catch (_err) {
      /* 同上 */
    }
  }

  // —— 底部删除：先确认再删 —— //
  function requestDelete(id: string): void {
    deleteTarget.value = eventStore.events.find((e) => e.id === id) ?? null
  }
  function cancelDelete(): void {
    deleteTarget.value = null
  }
  async function confirmDelete(): Promise<void> {
    const e = deleteTarget.value
    deleteTarget.value = null
    if (!e) return
    try {
      await eventStore.remove(e.id)
    } catch (_err) {
      /* 同上 */
    }
  }

  return {
    visible,
    mode,
    defaultType,
    defaultDate,
    eventId,
    editingEvent,
    deleteTarget,
    openCreate,
    openEdit,
    close,
    submitCreate,
    submitUpdate,
    requestDelete,
    cancelDelete,
    confirmDelete,
  }
})
import { onUnmounted, ref, watch } from 'vue'

export type DashboardWidgetId = 'today-events' | 'calendar' | 'pinned-event'

export interface DashboardWidgetPosition {
  col: number
  row: number
  colSpan: number
  rowSpan: number
}

export type DashboardWidgetLayout = Record<
  DashboardWidgetId,
  DashboardWidgetPosition
>

const GRID_SIZE = 4
const STORAGE_KEY = 'mymemo.dashboard.widget-layout.v1'

const DEFAULT_LAYOUT: DashboardWidgetLayout = {
  calendar: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
  'today-events': { col: 3, row: 1, colSpan: 2, rowSpan: 1 },
  'pinned-event': { col: 3, row: 2, colSpan: 2, rowSpan: 1 },
}

function cloneDefaultLayout(): DashboardWidgetLayout {
  return {
    calendar: { ...DEFAULT_LAYOUT.calendar },
    'today-events': { ...DEFAULT_LAYOUT['today-events'] },
    'pinned-event': { ...DEFAULT_LAYOUT['pinned-event'] },
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normalizePosition(
  id: DashboardWidgetId,
  raw: Partial<DashboardWidgetPosition> | undefined,
): DashboardWidgetPosition {
  const defaults = DEFAULT_LAYOUT[id]
  const maxCol = GRID_SIZE - defaults.colSpan + 1
  const maxRow = GRID_SIZE - defaults.rowSpan + 1

  return {
    // Span is intentionally always taken from the fixed registry. The current
    // phase supports moving widgets only; resizing is not persisted or exposed.
    colSpan: defaults.colSpan,
    rowSpan: defaults.rowSpan,
    col: clamp(Math.round(Number(raw?.col) || defaults.col), 1, maxCol),
    row: clamp(Math.round(Number(raw?.row) || defaults.row), 1, maxRow),
  }
}

function overlaps(
  a: DashboardWidgetPosition,
  b: DashboardWidgetPosition,
): boolean {
  return (
    a.col < b.col + b.colSpan &&
    a.col + a.colSpan > b.col &&
    a.row < b.row + b.rowSpan &&
    a.row + a.rowSpan > b.row
  )
}

function canPlace(
  layout: DashboardWidgetLayout,
  widgetId: DashboardWidgetId,
  candidate: DashboardWidgetPosition,
): boolean {
  return (Object.keys(layout) as DashboardWidgetId[]).every(
    (otherId) =>
      otherId === widgetId || !overlaps(candidate, layout[otherId]),
  )
}

function isValidLayout(layout: DashboardWidgetLayout): boolean {
  const ids = Object.keys(layout) as DashboardWidgetId[]
  return ids.every((widgetId) => canPlace(layout, widgetId, layout[widgetId]))
}

function loadLayout(): DashboardWidgetLayout {
  if (typeof window === 'undefined') return cloneDefaultLayout()

  try {
    const raw = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '{}',
    ) as Partial<DashboardWidgetLayout>
    const loaded: DashboardWidgetLayout = {
      calendar: normalizePosition('calendar', raw.calendar),
      'today-events': normalizePosition('today-events', raw['today-events']),
      'pinned-event': normalizePosition('pinned-event', raw['pinned-event']),
    }

    // A stale/corrupt layout should never leave the widgets overlapping.
    return isValidLayout(loaded) ? loaded : cloneDefaultLayout()
  } catch (_error) {
    return cloneDefaultLayout()
  }
}

function persistLayout(layout: DashboardWidgetLayout): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch (_error) {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

interface DragState {
  widgetId: DashboardWidgetId
  cellWidth: number
  cellHeight: number
  columnGap: number
  rowGap: number
  areaRect: DOMRect
  pointerOffsetX: number
  pointerOffsetY: number
}

export function useDashboardWidgetLayout() {
  const layout = ref<DashboardWidgetLayout>(loadLayout())
  const isEditMode = ref(false)
  const draggingWidgetId = ref<DashboardWidgetId | null>(null)

  let dragState: DragState | null = null

  watch(
    layout,
    (nextLayout) => {
      persistLayout(nextLayout)
    },
    { deep: true },
  )

  function widgetStyle(widgetId: DashboardWidgetId): Record<string, string> {
    const position = layout.value[widgetId]
    return {
      gridColumn: `${position.col} / span ${position.colSpan}`,
      gridRow: `${position.row} / span ${position.rowSpan}`,
    }
  }

  function enterEditMode(): void {
    isEditMode.value = true
  }

  function exitEditMode(): void {
    stopDragging()
    isEditMode.value = false
    persistLayout(layout.value)
  }

  function resetLayout(): void {
    stopDragging()
    layout.value = cloneDefaultLayout()
    persistLayout(layout.value)
  }

  function moveWidget(
    widgetId: DashboardWidgetId,
    requestedCol: number,
    requestedRow: number,
  ): void {
    const current = layout.value[widgetId]
    const next: DashboardWidgetPosition = {
      ...current,
      col: clamp(
        Math.round(requestedCol),
        1,
        GRID_SIZE - current.colSpan + 1,
      ),
      row: clamp(
        Math.round(requestedRow),
        1,
        GRID_SIZE - current.rowSpan + 1,
      ),
    }

    if (canPlace(layout.value, widgetId, next)) {
      layout.value[widgetId] = next
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!dragState) return

    const {
      widgetId,
      areaRect,
      cellWidth,
      cellHeight,
      columnGap,
      rowGap,
      pointerOffsetX,
      pointerOffsetY,
    } = dragState
    const nextLeft = event.clientX - areaRect.left - pointerOffsetX
    const nextTop = event.clientY - areaRect.top - pointerOffsetY
    const colStep = cellWidth + columnGap
    const rowStep = cellHeight + rowGap

    moveWidget(
      widgetId,
      Math.round(nextLeft / colStep) + 1,
      Math.round(nextTop / rowStep) + 1,
    )

  }

  function stopDragging(): void {
    if (!dragState) return
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', stopDragging)
    window.removeEventListener('pointercancel', stopDragging)
    dragState = null
    draggingWidgetId.value = null
  }

  function startDragging(
    widgetId: DashboardWidgetId,
    event: PointerEvent,
    areaElement: HTMLElement | null,
  ): void {
    if (!isEditMode.value || !areaElement || dragState) return

    const position = layout.value[widgetId]
    const areaRect = areaElement.getBoundingClientRect()
    const computedStyle = window.getComputedStyle(areaElement)
    const columnGap = Number.parseFloat(computedStyle.columnGap) || 0
    const rowGap = Number.parseFloat(computedStyle.rowGap) || 0
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0
    const cellWidth =
      (areaRect.width - columnGap * (GRID_SIZE - 1)) / GRID_SIZE
    const cellHeight =
      (areaRect.height - paddingTop - paddingBottom - rowGap * (GRID_SIZE - 1)) /
      GRID_SIZE
    const widgetLeft = (position.col - 1) * (cellWidth + columnGap)
    const widgetTop = paddingTop + (position.row - 1) * (cellHeight + rowGap)

    dragState = {
      widgetId,
      cellWidth,
      cellHeight,
      columnGap,
      rowGap,
      areaRect,
      pointerOffsetX: event.clientX - areaRect.left - widgetLeft,
      pointerOffsetY: event.clientY - areaRect.top - widgetTop,
    }
    draggingWidgetId.value = widgetId
    event.preventDefault()
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)
  }

  onUnmounted(stopDragging)

  return {
    layout,
    isEditMode,
    draggingWidgetId,
    widgetStyle,
    enterEditMode,
    exitEditMode,
    resetLayout,
    startDragging,
  }
}

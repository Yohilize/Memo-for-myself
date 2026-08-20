import { onUnmounted, ref, watch } from 'vue'

/**
 * Dashboard Widget 的布局管理。
 *
 * 设计要点：
 *  - 三个「固定组件」（今日事件 / 日历 / 固定事件）位置可由用户拖动，尺寸固定。
 *  - 「图片」小组件是动态组件：每次新增都生成一个唯一 id（= 图片记录主键），
 *    布局 key 直接用该 id，尺寸固定 1×1。删除组件时 key 一并移除。
 */

export type DashboardWidgetId = string

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

export interface CellMetrics {
  width: number
  height: number
  /** 单元宽高比（宽 / 高），用于裁剪框与最终显示比例对齐 */
  ratio: number
}

const GRID_SIZE = 4
const STORAGE_KEY = 'mymemo.dashboard.widget-layout.v1'

/** 图片组件固定为 1×1 */
const IMAGE_SPAN = { colSpan: 1, rowSpan: 1 }

/** 固定组件的 span 注册表；未在注册表内的 id（如图片）一律按 1×1 处理 */
const FIXED_SPAN: Record<string, { colSpan: number; rowSpan: number }> = {
  calendar: { colSpan: 2, rowSpan: 2 },
  'today-events': { colSpan: 2, rowSpan: 1 },
  'pinned-event': { colSpan: 2, rowSpan: 1 },
}

function spanFor(id: DashboardWidgetId): { colSpan: number; rowSpan: number } {
  return FIXED_SPAN[id] ?? IMAGE_SPAN
}

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
  const defaults = DEFAULT_LAYOUT[id] ?? { col: 1, row: 1 }
  const span = spanFor(id)
  const maxCol = GRID_SIZE - span.colSpan + 1
  const maxRow = GRID_SIZE - span.rowSpan + 1

  return {
    // Span 始终取固定注册表；当前阶段组件只支持拖动，不支持拖拽改尺寸。
    colSpan: span.colSpan,
    rowSpan: span.rowSpan,
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
    (otherId) => otherId === widgetId || !overlaps(candidate, layout[otherId]),
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
    // 从固定默认布局出发，再叠加持久化的条目（含动态图片组件 key）
    const loaded = cloneDefaultLayout()
    for (const [id, pos] of Object.entries(raw)) {
      loaded[id] = normalizePosition(id, pos)
    }

    // 损坏 / 过期布局不该让组件互相重叠
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

/**
 * 计算 Dashboard 网格的单元（一个 1×1 组件）尺寸与宽高比。
 * 与拖拽逻辑共用一套公式，保证裁剪框比例 = 组件实际显示比例。
 */
function computeCellMetrics(areaElement: HTMLElement): CellMetrics {
  const areaRect = areaElement.getBoundingClientRect()
  const computedStyle = window.getComputedStyle(areaElement)
  const columnGap = Number.parseFloat(computedStyle.columnGap) || 0
  const rowGap = Number.parseFloat(computedStyle.rowGap) || 0
  const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0
  const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0
  const width =
    (areaRect.width - columnGap * (GRID_SIZE - 1)) / GRID_SIZE
  const height =
    (areaRect.height - paddingTop - paddingBottom - rowGap * (GRID_SIZE - 1)) /
    GRID_SIZE
  return { width, height, ratio: width / height }
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
    if (!position) return {}
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
    const next = cloneDefaultLayout()
    // 保留动态图片组件的位置/尺寸，只把固定组件复位到默认
    for (const id of Object.keys(layout.value)) {
      if (!(id in DEFAULT_LAYOUT)) {
        next[id] = { ...layout.value[id] }
      }
    }
    layout.value = next
    persistLayout(layout.value)
  }

  /** 图片组件固定 1×1：把动态组件放置到第一个空闲单元；没有空位时返回 null */
  function placeImageWidget(widgetId: DashboardWidgetId): DashboardWidgetPosition | null {
    for (let row = 1; row <= GRID_SIZE; row++) {
      for (let col = 1; col <= GRID_SIZE; col++) {
        const candidate: DashboardWidgetPosition = {
          col,
          row,
          ...IMAGE_SPAN,
        }
        if (canPlace(layout.value, widgetId, candidate)) {
          layout.value[widgetId] = candidate
          return candidate
        }
      }
    }
    return null
  }

  /** 从布局中移除一个动态组件（固定组件为系统组件不可移除） */
  function removeWidget(widgetId: DashboardWidgetId): void {
    if (widgetId in layout.value) {
      delete layout.value[widgetId]
    }
  }

  function moveWidget(
    widgetId: DashboardWidgetId,
    requestedCol: number,
    requestedRow: number,
  ): void {
    const current = layout.value[widgetId]
    if (!current) return
    const span = spanFor(widgetId)
    const next: DashboardWidgetPosition = {
      ...current,
      col: clamp(
        Math.round(requestedCol),
        1,
        GRID_SIZE - span.colSpan + 1,
      ),
      row: clamp(
        Math.round(requestedRow),
        1,
        GRID_SIZE - span.rowSpan + 1,
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
    if (!position) return

    const areaRect = areaElement.getBoundingClientRect()
    const computedStyle = window.getComputedStyle(areaElement)
    const columnGap = Number.parseFloat(computedStyle.columnGap) || 0
    const rowGap = Number.parseFloat(computedStyle.rowGap) || 0
    const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0
    const { width: cellWidth, height: cellHeight } = computeCellMetrics(
      areaElement,
    )
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
    computeCellMetrics,
    enterEditMode,
    exitEditMode,
    resetLayout,
    placeImageWidget,
    removeWidget,
    startDragging,
  }
}
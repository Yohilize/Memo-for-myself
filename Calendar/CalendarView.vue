<script setup lang="ts">
import VueCal from 'vue-cal'
import 'vue-cal/dist/vuecal.css'
import dayjs from 'dayjs'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseConfirmDialog from '@/components/base/BaseConfirmDialog.vue'
import EventForm from '@calendar/EventForm.vue'
import { useEventStore } from '@/stores/eventStore'
import {
  mapEventsToDateIndicators,
  filterEventsForDay,
  dayEventTimeLabel,
  dayEventSortKey,
} from '@/services/eventCalendarMapper'
import type { TimeEvent, DurationEvent } from '@/types/event'
import type { CreateEventInput, UpdateEventInput } from '@/services/eventTypes'
import { STORAGE_KEYS } from '@/services/storageKeys'
import { DEFAULT_DURATION_COLOR } from '@/services/eventService'

/**
 * CalendarView 可在两种模式下使用：
 *  · embedded=false（默认）：独立页模式 `/calendar` —— 外层带 BaseCard + 页边距，作为完整页面。
 *  · embedded=true：嵌入模式（Dashboard 等宿主）—— 去掉外层卡片、页面级 padding 和冗余"日历"标题，
 *                    只保留月份导航、42 格网格和选中日期事件列表。
 * 任何模式下业务逻辑（点击/月份切换/Today 高光/Event Store）完全一致。
 *
 * 模板结构：两种模式分别展开，避免同文件多 script / 子组件的 Vue 编译陷阱。
 * 逻辑完全共享（同一个 setup），只是外层容器和 cal-header 的左标识有差异。
 */
const props = defineProps<{
  embedded?: boolean
}>()
const emit = defineEmits<{
  (event: 'edit-event', value: TimeEvent): void
  (event: 'delete-event', value: TimeEvent): void
}>()

const embedded = computed(() => !!props.embedded)
const eventStore = useEventStore()
const router = useRouter()

/** 独立页返回按钮：使用 Vue Router 回到 Dashboard（/）；embedded 模式不渲染 */
function goBackHome() {
  router.push('/')
}

/** 当前显示月份：MYMEMO 内部计算视图月标题 + Today 高光条件的辅助状态。
 *  注：Vue Cal 4.x 实际上不存在 viewDate prop；此处只做内部状态，不传给 Vue Cal。
 */
const viewDate = ref<Date>(dayjs().startOf('month').toDate())
const viewDateKey = computed(() => dayjs(viewDate.value).format('YYYY-MM'))

/** 当前选中日期：MYMEMO 唯一真源；**单向绑定**。
 *  只通过 @cell-click 更新；不接受 VueCal 通过 @update:selected-date 回写，
 *  避免"回写 → prop 感知更新 → 再回写"的循环更新。
 */
const selectedDateKey = ref<string>(dayjs().format('YYYY-MM-DD'))

/** 顶部年月标题：基于 viewDate，避免跨月选中时标题乱跳 */
const titleText = computed(() =>
  dayjs(viewDate.value).format('YYYY 年 M 月'),
)
const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

/** 设置视图月（按月份对齐到 1 号） */
function setViewMonth(raw: Date | string | dayjs.Dayjs) {
  const target = dayjs(raw).startOf('month')
  if (!target.isValid()) return
  if (target.format('YYYY-MM') === viewDateKey.value) return
  viewDate.value = target.toDate()
}
function prevMonth() {
  setViewMonth(dayjs(viewDate.value).subtract(1, 'month'))
}
function nextMonth() {
  setViewMonth(dayjs(viewDate.value).add(1, 'month'))
}
function goToday() {
  const today = dayjs()
  setViewMonth(today)
  const todayK = today.format('YYYY-MM-DD')
  if (todayK !== selectedDateKey.value) selectedDateKey.value = todayK
}

const calOptions = {
  // ⚠️ Vue Cal 4.10.2 真正的根组件视图 prop 是 activeView，不是 view！
  //    默认值 activeView = "week"（周视图，00:00~23:00 按小时大格子）
  //    之前传 view: 'month' 完全没命中，这就是导致"大方格时间轴"的根本原因。
  activeView: 'month' as const,
  // 隐藏 Vue Cal 内置视图选择器（8 个按钮：年/本年/月/周/日 等）的 prop 名也是 hideViewSelector，不是 hideViews。
  // 我们另外还通过 .vuecal__header { display:none } 硬隐藏；此处 prop 层面也再禁用一层。
  hideViewSelector: true,
  // 周起始日正确 prop：startWeekOnSunday=false 即「周一」为首列，对应你图2的 一 二 三 四 五 六 日。
  // Vue Cal 4.x 默认值就是 false（周一开始），此处显式传是为了避免语义歧义。
  startWeekOnSunday: false,
  // —— 以下三项彻底禁用 Vue Cal 默认的「点击/双击 → 更窄视图（周/日时间轴）或创建事件」行为 ——
  //  Vue Cal 默认 dblclickToNavigate=true：双击任一日格会 switchToNarrowerView()，
  //  从月视图一路切到「日视图（00:00~23:00 时间轴）」——这就是不想要的「日内时间段界面」。
  // 这里在 prop 层面显式关闭，而不是仅靠 CSS/UI 隐藏。
  dblclickToNavigate: false, // 双击不再切入周/日时间轴视图
  clickToNavigate: false,     // 单击也不导航（默认已 false，显式声明防回归）
  // 默认 cellClickHold=true：在月视图按住一格会创建事件；dragToCreateEvent=true 会在周/日拖动建事件。
  // 一并关闭，防止双击之外产生自动创建/编辑日内时间段的副作用。
  cellClickHold: false,
  dragToCreateEvent: false,
  // —— 以下是 MYMEMO 自定义辅助参数（Vue Cal 会忽略未知 prop）——
  // cellHeight 与 spacing 目前不被 Vue Cal 4.x 根组件消费；我们已通过 .vuecal__body { gap: var(--space-2) }
  // 和 .vuecal__cell { min-height: var(--cal-cell-h, 56px) } 自定义 CSS 变量实现相同效果。
  // 此处保留仅作为可读性说明：理想月历 cell 高度 56px、网格横竖向 gap 6px。
  cellHeight: 56,
  spacing: 6,
}

/** 事件 → 按日期聚合的轻量指标 */
const indicators = computed(() =>
  mapEventsToDateIndicators(eventStore.events ?? []),
)

const todayKey = dayjs().format('YYYY-MM-DD')
const todayMonthKey = dayjs().format('YYYY-MM')
/** 当前视图显示今天所在月份 → Today 高光才显示 */
const isShowingCurrentMonth = computed(
  () => viewDateKey.value === todayMonthKey,
)

/** 给 vue-cal 的 :selected-date 喂 Date 对象；
 *  ⚠️ Vue Cal 4.x 无独立 viewDate prop；只能靠 selectedDate prop 变化 → watch.selectedDate → updateSelectedDate → switchView 重建 42 格。
 */
const selectedDateForVueCal = computed<Date>(() => {
  const selectedDj = dayjs(selectedDateKey.value)
  const selectedMonth = selectedDj.isValid()
    ? selectedDj.format('YYYY-MM')
    : ''
  if (selectedMonth === viewDateKey.value) {
    return selectedDj.startOf('day').toDate()
  }
  // 浏览其他月：返回视图月首日 → 强制触发 switchView 重建正确月
  return dayjs(viewDate.value).startOf('month').toDate()
})

/** 选中日期当天的事件列表（排序后给模板） */
const eventsForSelectedDay = computed<TimeEvent[]>(() => {
  const key = selectedDateKey.value
  const all = filterEventsForDay(eventStore.events ?? [], key)
  return [...all].sort((a, b) =>
    dayEventSortKey(a, key).localeCompare(dayEventSortKey(b, key)),
  )
})

const typeLabelByType: Record<string, string> = {
  calendar: '行程',
  deadline: 'Deadline',
  duration: '时间块',
  idea: '灵感',
}

/**
 * 统一入口：设置选中日期；若跨月则同步跳转到目标月。
 *  ⚠️ Vue Cal 4.x 无独立 viewDate prop；跨月必须同步更新 viewDate，
 *     保证 selectedDateForVueCal 在同一响应式 tick 里算出目标月份锚点，触发 switchView。
 */
function setSelectedDate(raw: Date | string | null | undefined) {
  const dj = raw ? dayjs(raw) : dayjs()
  if (!dj.isValid()) return
  const key = dj.format('YYYY-MM-DD')
  if (key === selectedDateKey.value) return
  const targetMonth = dj.format('YYYY-MM')
  if (viewDateKey.value !== targetMonth) {
    setViewMonth(dj)
  }
  selectedDateKey.value = key
}

/** 从 Vue Cal 的 cell 载荷中解析日期键 'YYYY-MM-DD' */
function cellKeyOf(payload: unknown): string | null {
  if (payload instanceof Date) return dayjs(payload).format('YYYY-MM-DD')
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    if (obj.date instanceof Date) return dayjs(obj.date).format('YYYY-MM-DD')
    if (typeof obj.formattedDate === 'string') return obj.formattedDate as string
  }
  return null
}

/** 双击状态机：普通状态 → 双击开始 → 调整结束日期 → 双击确认 → 完成。
 *  手动双击检测：记录最近一次格点击的时间与键；两次同一格的快速点击视为双击。
 *  Vue Cal 选中日期会重建格子 DOM，原生 @dblclick 因节点被替换而经常无法触发，
 *  所以在 @cell-click 上用「时间内判定」实现同样的双击语义，状态存于组件内（跨重渲染存活）。 */
let durLastClick = { key: '', time: 0 }

/** 格点击统一入口：单点=选中/预览；同一格 600ms 内再次点击=双击（进入选择 / 确认结束日期） */
function onCellClick(payload: unknown) {
  const key = cellKeyOf(payload)
  if (!key) return
  const now = performance.now()
  const isDouble = key === durLastClick.key && now - durLastClick.time < 600
  durLastClick = { key, time: now }

  setSelectedDate(key)

  if (durSelect.active) {
    // 选择结束日期模式：预览延伸主要由鼠标移动(@mousemove)驱动；
    // 单击同样更新预览终点（触屏/自动操作兜底），双击 → 确认结束日期。
    if (isDouble) {
      confirmDurEnd()
      return
    }
    updatePreviewEnd(key)
    return
  }

  // 普通模式双击：若命中的是「无结束日期」时间块的开始日期 → 进入「设置结束日期」模式
  if (isDouble) {
    const block = allDurationBlocks().find(
      (b) => b.end_date == null && b.start_date === key,
    )
    if (block) {
      durSelect.active = true
      durSelect.blockId = block.id
      previewEndKey.value = block.start_date
    }
  }
}

/** dot 颜色：全部走 tokens.css 语义变量 */
const dotVarByType: Record<string, string> = {
  calendar: 'var(--color-event-calendar)',
  deadline: 'var(--color-event-deadline)',
  duration: 'var(--color-event-duration)',
  idea: 'var(--color-event-idea)',
}

function orderedTypes(dKey: string): string[] {
  const ind = indicators.value[dKey]
  if (!ind) return []
  const order: string[] = ['deadline', 'duration', 'calendar', 'idea']
  return order.filter((t) => {
    // 开启「显示时间块」时，duration 用色块呈现，不再叠加小圆点
    if (t === 'duration' && showDurationBlocks.value) return false
    return ind.byType[t as never] > 0
  })
}

/* ==============================================================================
 *  时间块色块：生成「显示时间块」开关、覆盖映射、lane 分配与双击交互
 * ============================================================================== */
/**
 * 日历中「显示时间块」开关。
 * 开启：有明确结束日期的时间块以对应颜色在对应日期上连成色块；无结束日期的只在开始日期显示一格。
 * 关闭：退回传统小圆点 indicator。
 * 默认关闭，且开关状态持久化到 localStorage，刷新/下次进入保持一致。
 */
const DUR_TOGGLE_KEY = STORAGE_KEYS.calShowDurationBlocks

function loadShowDurationBlocks(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(DUR_TOGGLE_KEY) === '1'
  } catch (_error) {
    return false
  }
}
function persistShowDurationBlocks(value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (value) {
      window.localStorage.setItem(DUR_TOGGLE_KEY, '1')
    } else {
      window.localStorage.removeItem(DUR_TOGGLE_KEY)
    }
  } catch (_error) {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

const showDurationBlocks = ref(loadShowDurationBlocks())

/** 无结束日期的时间块 → 双击其开始日期，进入「选择结束日期」模式 */
const durSelect = reactive({ active: false, blockId: '' })
/** 选择模式下预览到的结束日期（>= 开始日期） */
const previewEndKey = ref<string | null>(null)
/** 「将此时间块结束于 X？」确认弹窗 */
const durConfirm = reactive({ visible: false, blockId: '', endKey: '' })

function toggleDurationBlocks() {
  showDurationBlocks.value = !showDurationBlocks.value
  if (!showDurationBlocks.value) exitDurSelect()
  persistShowDurationBlocks(showDurationBlocks.value)
}

function allDurationBlocks(): DurationEvent[] {
  return (eventStore.events ?? []).filter((e): e is DurationEvent => e.type === 'duration')
}

/** 「可设置结束日期」的时间块：无结束日期时间块的开始日期键集合，用于悬浮高亮提示它可操作。 */
const routableStartKeys = computed<Set<string>>(() => {
  const s = new Set<string>()
  for (const b of allDurationBlocks()) {
    if (b.end_date == null) s.add(b.start_date)
  }
  return s
})

/** 选择结束日期模式下：鼠标移动 → 按「日期」实时预览结束日期，色块跟随延伸。
 *  通过 data-date 命中当前悬浮的格子，不依赖浏览器原生 dblclick。 */
function onDurMove(e: MouseEvent) {
  if (!durSelect.active) return
  const el = (e.target as HTMLElement | null)?.closest?.('[data-date]') as HTMLElement | null
  if (!el) return
  updatePreviewEnd(el.getAttribute('data-date') ?? '')
}

/** 某个时间块在当前交互下的「有效结束日期」（选择预览期间取 preview） */
function effEndKey(b: DurationEvent): string {
  if (durSelect.active && b.id === durSelect.blockId && previewEndKey.value) {
    return previewEndKey.value
  }
  return b.end_date ?? b.start_date
}

/** 按日期聚合覆盖该日的时间块（仅开启开关并展示颜色块时计算） */
const durCovers = computed<Record<string, DurationEvent[]>>(() => {
  const map: Record<string, DurationEvent[]> = {}
  if (!showDurationBlocks.value) return map
  for (const b of allDurationBlocks()) {
    const s = dayjs(b.start_date)
    const end = dayjs(effEndKey(b))
    if (!s.isValid() || !end.isValid() || end.isBefore(s, 'day')) continue
    let cur = s
    let guard = 0
    while (cur.isBefore(end) || cur.isSame(end, 'day')) {
      const k = cur.format('YYYY-MM-DD')
      ;(map[k] ??= []).push(b)
      cur = cur.add(1, 'day')
      if (++guard > 1000) break
    }
  }
  return map
})

/**
 * 为每个时间块分配一条纵向「泳道」，使同一天重叠的色块上下错开、互不覆盖；
 * 同一块在整个区间内泳道固定，跨格/跨行连续。贪心区间着色。
 */
const durLanes = computed<Record<string, number>>(() => {
  const lanes: Record<string, number> = {}
  const blocks = allDurationBlocks().sort((a, b) =>
    a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0,
  )
  const laneEnds: string[] = []
  for (const b of blocks) {
    const s = dayjs(b.start_date)
    if (!s.isValid()) continue
    const end = effEndKey(b)
    let lane = 0
    while (lane < laneEnds.length) {
      const prevEnd = laneEnds[lane]
      // 不重叠判定：上一块结束日 < 本块开始日（按天）
      if (prevEnd && dayjs(prevEnd).isBefore(s, 'day')) break
      lane++
    }
    laneEnds[lane] = end
    lanes[b.id] = lane
  }
  return lanes
})

/** 色块条的圆角形态：整体开始/结束/居中/单日 */
function durBarClass(b: DurationEvent, key: string): string {
  const s = b.start_date
  const e = effEndKey(b)
  const cls: string[] = []
  if (key === s && key === e) cls.push('is-single')
  else if (key === s) cls.push('is-start')
  if (key === e) cls.push('is-end')
  return cls.join(' ')
}
function durBarStyle(b: DurationEvent): Record<string, string> {
  const c = b.color || DEFAULT_DURATION_COLOR
  return {
    background: `color-mix(in srgb, ${c} 30%, transparent)`,
    borderColor: c,
    // 泳道纵向偏移：同一天重叠的色块上下错开，互不覆盖
    '--lane': String(durLanes.value[b.id] ?? 0),
  }
}

function updatePreviewEnd(key: string) {
  const block = allDurationBlocks().find((b) => b.id === durSelect.blockId)
  if (!block) return
  // 结束日期只能早于等于，不能早于开始日期
  if (key >= block.start_date) previewEndKey.value = key
}

function confirmDurEnd() {
  const endKey = previewEndKey.value
  if (!endKey || !durSelect.blockId) return
  durConfirm.blockId = durSelect.blockId
  durConfirm.endKey = endKey
  durConfirm.visible = true
}
function cancelDurEnd() {
  durConfirm.visible = false
  exitDurSelect()
}
async function applyDurEnd() {
  const { blockId, endKey } = durConfirm
  durConfirm.visible = false
  exitDurSelect()
  if (!blockId || !endKey) return
  try {
    await eventStore.update(blockId, { end_date: endKey })
  } catch (_err) {
    // 错误文案已在 eventStore.error 中
  }
}
function exitDurSelect() {
  durSelect.active = false
  durSelect.blockId = ''
  previewEndKey.value = null
}

const durConfirmTitle = computed(() => {
  if (!durConfirm.blockId) return ''
  const b = (eventStore.events ?? []).find((e) => e.id === durConfirm.blockId)
  return b && b.type === 'duration' ? b.title : ''
})

/* ==============================================================================
 *  CRUD UI：EventForm（新增 / 编辑） + 编辑 / 删除入口
 * ============================================================================== */
const formVisible = ref(false)
const editingEvent = ref<TimeEvent | null>(null)
const deleteTarget = ref<TimeEvent | null>(null)

/** 点右下角「+」：新增，默认日期 = Calendar 选中日期 */
function openCreateForm() {
  editingEvent.value = null
  formVisible.value = true
}
/** 点某事件「编辑」：把该事件作为 editingEvent 传入 */
function openEditForm(e: TimeEvent) {
  if (embedded.value) {
    emit('edit-event', e)
    return
  }
  editingEvent.value = e
  formVisible.value = true
}
/** 提交新增：走 Store，Pinia 响应式会自动刷新 indicator + 选中日期列表 + Dashboard 今日事件 */
async function handleSubmitCreate(input: CreateEventInput) {
  try {
    await eventStore.create(input)
    formVisible.value = false
  } catch (err) {
    // 仅吞掉异常以免 UI 卡住；错误文案已经存在 eventStore.error 中
  }
}
/** 提交编辑：走 Store.update（id 不丢） */
async function handleSubmitUpdate(id: string, patch: UpdateEventInput) {
  try {
    await eventStore.update(id, patch)
    formVisible.value = false
    editingEvent.value = null
  } catch (_err) {
    // 同上
  }
}
/** 删除：先打开 MYMEMO 玻璃确认层，确认后才触发 Store.remove。 */
function requestDelete(e: TimeEvent) {
  if (embedded.value) {
    emit('delete-event', e)
    return
  }
  deleteTarget.value = e
}
function cancelDelete() {
  deleteTarget.value = null
}
async function confirmDelete() {
  const e = deleteTarget.value
  if (!e) return
  deleteTarget.value = null
  try {
    await eventStore.remove(e.id)
    if (editingEvent.value?.id === e.id) editingEvent.value = null
  } catch (_err) {
    // 同上
  }
}

onMounted(() => {
  eventStore.loadAll()
})
</script>

<template>
  <!-- ============ 独立页模式 /calendar：页面级 padding + 一张 BaseCard ============ -->
  <div v-if="!embedded" class="calendar-page">
    <BaseCard padding="md" class="calendar-wrap">
      <!-- 自定义头部：左"日历"标识 + 右月份控件 + 新增按钮；全部自管，不使用 VueCal 默认 toolbar -->
      <div class="cal-header">
        <div class="cal-nav-left">
          <button
            class="cal-back-btn"
            type="button"
            aria-label="返回 Dashboard"
            title="返回"
            @click="goBackHome"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          </button>
          <svg class="cal-ic" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/></svg>
          <span class="cal-title-label">日历</span>
        </div>
        <div class="cal-nav-right">
          <BaseButton variant="ghost" size="sm" @click="prevMonth">‹</BaseButton>
          <span class="cal-title">{{ titleText }}</span>
          <BaseButton variant="ghost" size="sm" @click="nextMonth">›</BaseButton>
          <BaseButton variant="ghost" size="sm" class="cal-today-btn" @click="goToday">今天</BaseButton>
          <button
            class="cal-add-btn"
            type="button"
            aria-label="新增事件"
            title="新增事件"
            @click="openCreateForm"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button
            type="button"
            class="cal-dur-toggle-btn"
            :class="{ on: showDurationBlocks }"
            :aria-pressed="showDurationBlocks"
            :title="showDurationBlocks ? '隐藏时间块' : '显示时间块'"
            @click="toggleDurationBlocks"
          >
            <span class="cdtb-dot" aria-hidden="true"></span>
            <span class="cdtb-text">时间块</span>
          </button>
        </div>
      </div>

      <!-- Vue Cal 42 格：自定义 cell-content slot 完全重写 cell 视觉 -->
      <!-- 外层 .cal-host 是 relative 容器，用于承载「+」悬浮按钮；不改变原布局尺寸 -->
      <div class="cal-host">
        <div class="mymemo-cal" @mousemove="onDurMove">
          <div class="mymemo-weekdays" aria-hidden="true">
            <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
          </div>
          <VueCal
            v-bind="calOptions"
            :events="[]"
            :selected-date="selectedDateForVueCal"
            locale="zh-cn"
            @cell-click="onCellClick"
          >
            <template #cell-content="{ cell }">
              <div
                class="vc-cell-inner"
                :data-date="cell.formattedDate"
                :class="{ 'is-routable-start': routableStartKeys.has(cell.formattedDate) }"
              >
                <span
                  class="vc-day-num"
                  :class="{
                    'is-today': isShowingCurrentMonth && (cell.formattedDate === todayKey || cell.today),
                    'is-selected': cell.formattedDate === selectedDateKey,
                    'is-weekday-outside': cell.outOfScope,
                  }"
                >
                  {{ cell.content }}
                </span>
                <div
                  class="vc-indicators"
                  v-if="indicators[cell.formattedDate]?.hasEvent"
                >
                  <span
                    v-for="t in orderedTypes(cell.formattedDate).slice(0, 3)"
                    :key="t"
                    class="vc-dot"
                    :style="{ backgroundColor: dotVarByType[t] }"
                    :title="typeLabelByType[t] ?? t"
                  ></span>
                </div>
                <div
                  v-if="showDurationBlocks && durCovers[cell.formattedDate]?.length"
                  class="vc-dur-layer"
                >
                  <span
                    v-for="b in durCovers[cell.formattedDate]"
                    :key="b.id"
                    class="vc-dur-bar"
                    :class="[
                      durBarClass(b, cell.formattedDate),
                      durSelect.active && b.id === durSelect.blockId ? 'is-preview' : '',
                    ]"
                    :style="durBarStyle(b)"
                    :title="b.title"
                  ></span>
                </div>
              </div>
            </template>
          </VueCal>
        </div>
      </div>

      <!-- 选择结束日期提示（开关已移到右上角 header） -->
      <div v-if="durSelect.active" class="cal-dur-toggle-row">
        <span class="cdt-hint">
          正在选择结束日期：单击日期预览，再次双击确认
        </span>
      </div>

      <!-- 选中日期 → 当天事件列表 -->
      <div class="day-events" v-if="selectedDateKey">
        <div class="day-events-head">
          <span class="day-events-date">
            {{ dayjs(selectedDateKey).format('M 月 D 日') }}
            <small class="day-events-weekday">
              {{ dayjs(selectedDateKey).format('dddd') }}
            </small>
          </span>
          <span class="day-events-count" v-if="eventsForSelectedDay.length">
            {{ eventsForSelectedDay.length }} 项
          </span>
        </div>
        <div class="day-events-list" v-if="eventsForSelectedDay.length">
          <div
            v-for="e in eventsForSelectedDay"
            :key="e.id"
            class="day-event-row"
            :title="`${typeLabelByType[e.type]} · 点击编辑`"
            @click="openEditForm(e)"
          >
            <span
              class="day-event-type-dot"
              :style="{ backgroundColor: dotVarByType[e.type] }"
              :aria-label="typeLabelByType[e.type]"
            ></span>
            <span class="day-event-time">
              {{ dayEventTimeLabel(e, selectedDateKey) }}
            </span>
            <span class="day-event-title">{{ e.title }}</span>
            <div class="day-event-actions">
              <button
                class="de-btn"
                type="button"
                aria-label="编辑"
                title="编辑"
                @click.stop="openEditForm(e)"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
              </button>
              <button
                class="de-btn de-btn--danger"
                type="button"
                aria-label="删除"
                title="删除"
                @click.stop="requestDelete(e)"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div class="day-events-empty" v-else>
          <span class="empty-icon" aria-hidden="true">·</span>
          <span class="empty-text">今天还没有安排</span>
        </div>
      </div>
    </BaseCard>
  </div>

  <!-- ============ 嵌入模式 Dashboard：去掉外层卡片 + 冗余"日历"标题 ============ -->
  <div v-else class="cal-embedded">
    <!-- 只有月份导航控件（宿主自己有模块标题/侧边栏标识） -->
    <div class="cal-header cal-header--embedded">
      <div class="cal-nav-right">
        <BaseButton variant="ghost" size="sm" @click="prevMonth">‹</BaseButton>
        <span class="cal-title">{{ titleText }}</span>
        <BaseButton variant="ghost" size="sm" @click="nextMonth">›</BaseButton>
        <BaseButton variant="ghost" size="sm" class="cal-today-btn" @click="goToday">今天</BaseButton>
        <button
          class="cal-add-btn"
          type="button"
          aria-label="新增事件"
          title="新增事件"
          @click="openCreateForm"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <button
          type="button"
          class="cal-dur-toggle-btn"
          :class="{ on: showDurationBlocks }"
          :aria-pressed="showDurationBlocks"
          :title="showDurationBlocks ? '隐藏时间块' : '显示时间块'"
          @click="toggleDurationBlocks"
        >
          <span class="cdtb-dot" aria-hidden="true"></span>
          <span class="cdtb-text">时间块</span>
        </button>
      </div>
    </div>

    <!-- Vue Cal 42 格：与独立页完全相同 -->
    <div class="cal-host">
      <div class="mymemo-cal" @mousemove="onDurMove">
        <div class="mymemo-weekdays" aria-hidden="true">
          <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
        </div>
        <VueCal
          v-bind="calOptions"
          :events="[]"
          :selected-date="selectedDateForVueCal"
          locale="zh-cn"
          @cell-click="onCellClick"
        >
          <template #cell-content="{ cell }">
            <div
              class="vc-cell-inner"
              :data-date="cell.formattedDate"
              :class="{ 'is-routable-start': routableStartKeys.has(cell.formattedDate) }"
            >
              <span
                class="vc-day-num"
                :class="{
                  'is-today': isShowingCurrentMonth && (cell.formattedDate === todayKey || cell.today),
                  'is-selected': cell.formattedDate === selectedDateKey,
                  'is-weekday-outside': cell.outOfScope,
                }"
              >
                {{ cell.content }}
              </span>
              <div
                class="vc-indicators"
                v-if="indicators[cell.formattedDate]?.hasEvent"
              >
                <span
                  v-for="t in orderedTypes(cell.formattedDate).slice(0, 3)"
                  :key="t"
                  class="vc-dot"
                  :style="{ backgroundColor: dotVarByType[t] }"
                  :title="typeLabelByType[t] ?? t"
                ></span>
              </div>
              <div
                v-if="showDurationBlocks && durCovers[cell.formattedDate]?.length"
                class="vc-dur-layer"
              >
                <span
                  v-for="b in durCovers[cell.formattedDate]"
                  :key="b.id"
                  class="vc-dur-bar"
                  :class="[
                    durBarClass(b, cell.formattedDate),
                    durSelect.active && b.id === durSelect.blockId ? 'is-preview' : '',
                  ]"
                  :style="durBarStyle(b)"
                  :title="b.title"
                ></span>
              </div>
            </div>
          </template>
        </VueCal>
      </div>
    </div>

    <!-- 选择结束日期提示（开关已移到右上角 header） -->
    <div v-if="durSelect.active" class="cal-dur-toggle-row">
      <span class="cdt-hint">
        正在选择结束日期：移动鼠标延伸色块，在目标日期双击确认
      </span>
    </div>

    <!-- 选中日期 → 当天事件列表：与独立页完全相同 -->
    <div class="day-events" v-if="selectedDateKey">
      <div class="day-events-head">
        <span class="day-events-date">
          {{ dayjs(selectedDateKey).format('M 月 D 日') }}
          <small class="day-events-weekday">
            {{ dayjs(selectedDateKey).format('dddd') }}
          </small>
        </span>
        <span class="day-events-count" v-if="eventsForSelectedDay.length">
          {{ eventsForSelectedDay.length }} 项
        </span>
      </div>
      <div class="day-events-list" v-if="eventsForSelectedDay.length">
        <div
          v-for="e in eventsForSelectedDay"
          :key="e.id"
          class="day-event-row"
          :title="`${typeLabelByType[e.type]} · 点击编辑`"
          @click="openEditForm(e)"
        >
          <span
            class="day-event-type-dot"
            :style="{ backgroundColor: dotVarByType[e.type] }"
            :aria-label="typeLabelByType[e.type]"
          ></span>
          <span class="day-event-time">
            {{ dayEventTimeLabel(e, selectedDateKey) }}
          </span>
          <span class="day-event-title">{{ e.title }}</span>
          <div class="day-event-actions">
            <button
              class="de-btn"
              type="button"
              aria-label="编辑"
              title="编辑"
              @click.stop="openEditForm(e)"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
            </button>
            <button
              class="de-btn de-btn--danger"
              type="button"
              aria-label="删除"
              title="删除"
              @click.stop="requestDelete(e)"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div class="day-events-empty" v-else>
        <span class="empty-icon" aria-hidden="true">·</span>
        <span class="empty-text">今天还没有安排</span>
      </div>
    </div>
  </div>

  <!-- ===== 全局 CRUD 表单弹窗（新增/编辑共用；fixed 覆盖全屏，不受 Calendar 容器裁剪影响）===== -->
  <EventForm
    v-model:visible="formVisible"
    :default-date="selectedDateKey"
    :editing-event="editingEvent"
    @submit-create="handleSubmitCreate"
    @submit-update="handleSubmitUpdate"
    @delete="(id) => { const e = eventStore.events.find(x => x.id === id); if (e) requestDelete(e) }"
  />
  <BaseConfirmDialog
    :visible="!!deleteTarget"
    :event-title="deleteTarget?.title ?? ''"
    @cancel="cancelDelete"
    @confirm="confirmDelete"
  />

  <!-- 时间块结束日期确认弹窗：确认后正式写入 end_date -->
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div
        v-if="durConfirm.visible"
        class="dur-confirm-mask"
        role="presentation"
        @click.self="cancelDurEnd"
      >
        <div class="dur-confirm-dialog" role="dialog" aria-modal="true">
          <div class="dur-confirm-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6"/><path d="M12 16h.01"/></svg>
          </div>
          <div class="dur-confirm-copy">
            <h2 class="dur-confirm-title">
              将此时间块结束于 {{ dayjs(durConfirm.endKey).format('M 月 D 日') }}？
            </h2>
            <p class="dur-confirm-event">{{ durConfirmTitle }}</p>
            <p class="dur-confirm-hint">确认后，该时间块将覆盖其开始日期至所选日期。</p>
          </div>
          <div class="dur-confirm-actions">
            <BaseButton variant="ghost" size="sm" @click="cancelDurEnd">取消</BaseButton>
            <BaseButton variant="primary" size="sm" @click="applyDurEnd">确认</BaseButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ============ Calendar 嵌入 Dashboard 时的布局（更紧凑） ============ */
.cal-embedded {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;                          /* 原 12px → 8px，和缩小后的月历更协调 */
}
.cal-header--embedded {
  justify-content: flex-end;
  margin-bottom: 2px;                 /* 原 4px → 2px */
}

/* ============ 独立页尺寸 ============ */
.calendar-page {
  height: 100%;
  padding: var(--space-5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.calendar-wrap {
  width: min(100%, 520px);            /* 原 620px → 520px，整体收窄让它更"小巧精致"，对齐图2宽度 */
}

/* —— 头部：Axolotl Dashboard 风格（尺寸收紧） —— */
.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;                 /* 原 10px → 6px */
}
.cal-nav-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
}
.cal-ic {
  color: var(--color-primary);
  opacity: 0.9;
  display: block;
}
.cal-title-label {
  font-size: 13px;                    /* 原 text-base(≈14px) → 13px，缩小 */
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  letter-spacing: 0.01em;
}
/* —— 独立页返回按钮：轻量玻璃胶囊，与「+」新增按钮同源质感 —— */
.cal-back-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: min(var(--glass-radius, 16px), 10px);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.cal-back-btn:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  box-shadow: var(--glass-shadow-hover), var(--glass-highlight);
  color: var(--color-primary);
  transform: translateX(-1px);
}
.cal-back-btn:active {
  transform: translateX(0) scale(0.96);
}
.cal-nav-right {
  display: flex;
  align-items: center;
  gap: 4px;                          /* 原 2px → 4px，容纳新增 + 按钮后保持呼吸感 */
}
.cal-today-btn {
  margin-left: 2px;                   /* 原 4px → 2px，+ 按钮独立间距控制 */
  font-size: 10px;                    /* 原 11px → 10px */
  padding: 2px 7px !important;
  color: var(--color-primary);
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
  border-radius: 999px;
}
/*
 * 「显示时间块」开关（右上角 header）：
 * 玻璃小胶囊，与 today / + 按钮同质感。开 = accent 实心，关 = 玻璃描边。
 */
.cal-dur-toggle-btn {
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  color: var(--color-text-secondary);
  font-size: 10px;
  font-weight: var(--font-medium);
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.cal-dur-toggle-btn:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  box-shadow: var(--glass-shadow-hover), var(--glass-highlight);
  color: var(--color-primary);
  transform: translateY(-1px);
}
.cal-dur-toggle-btn:active {
  transform: translateY(0) scale(0.97);
}
.cal-dur-toggle-btn.on {
  color: var(--color-text-on-gradient);
  background: var(--color-accent);
  border-color: color-mix(in srgb, var(--color-accent) 60%, transparent);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--color-accent) 25%, transparent);
}
.cdtb-dot {
  width: 6px;
  height: 6px;
  border-radius: 2px;
  background: var(--color-text-tertiary);
  flex: 0 0 auto;
  transition: background var(--duration-fast) var(--ease-out);
}
.cal-dur-toggle-btn.on .cdtb-dot {
  background: var(--color-text-on-gradient);
}
.cal-title {
  min-width: 78px;                    /* 原 90px → 78px，字号缩了就不用那么宽 */
  text-align: center;
  font-size: 12px;                    /* 原 13px → 12px */
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  letter-spacing: 0.02em;
  user-select: none;
}

/*
 * ====== .mymemo-cal：纸面留白日历 ======
 * 日历本体保持透明，让宿主的暖白/玻璃背景自然露出；日期的排版、列宽和行间距
 * 负责建立结构，只有选中日和 Today 才使用轻量的强调底色。
 */
.mymemo-cal {
  background: transparent;
  border: none;
  padding: 0;
  /* —— Vue Cal CSS 变量：清除默认表格皮肤 —— */
  --vc-color: var(--color-text-primary);
  --vc-background-color: transparent;
  --vc-border: none;
  --vc-border-radius: 0;
  --vc-shadow: none;
  --vc-toolbar-color: var(--color-text-primary);
  --vc-cell-background-color: transparent;
  --vc-cell-border: none;
  --vc-cell-border-radius: 0;
  --vc-cell-head-color: var(--color-text-tertiary);
  --vc-weekdays-color: var(--color-text-tertiary);
  --vc-selected-color: var(--color-text-primary);
  --vc-selected-background-color: transparent;
  --vc-today-color: var(--color-text-primary);
  --vc-today-background-color: transparent;
  /* —— 由留白构成的月历节奏 —— */
  --cal-cell-h: 46px;
}

/* 自定义轻量星期标题：保持周一至周日顺序，不引入传统表格表头的重量感。 */
.mymemo-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  margin-bottom: 8px;
  color: var(--color-text-tertiary);
  font-size: 10px;
  font-weight: var(--font-semibold);
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-align: center;
  user-select: none;
}
.mymemo-weekdays span {
  min-width: 0;
}

/* —— Vue Cal 默认容器：透明、无边框、无阴影 —— */
.mymemo-cal :deep(.vuecal),
.mymemo-cal :deep(.vuecal__flex),
.mymemo-cal :deep(.vuecal__body),
.mymemo-cal :deep(.vuecal__bg),
.mymemo-cal :deep(.vuecal__cells),
.mymemo-cal :deep(.vuecal__weekdays-headings) {
  background: transparent !important;
  background-image: none !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  outline: none !important;
}

/* —— Vue Cal 默认工具栏彻底隐藏 —— */
.mymemo-cal :deep(.vuecal__header) {
  display: none !important;
}
.mymemo-cal :deep(.vuecal-toolbar),
.mymemo-cal :deep([class*="vuecal"][class*="header" i]) {
  display: none !important;
}

/* —— 星期标题：只保留轻微的字面层级，不画底线 —— */
.mymemo-cal :deep(.vuecal__weekdays-headings) {
  display: none !important;
}
.mymemo-cal :deep(.vuecal__heading),
.mymemo-cal :deep(.vuecal__weekdays-cell) {
  background: transparent !important;
  border: none !important;
  color: var(--color-text-tertiary);
  font-size: 10px;
  font-weight: var(--font-semibold);
  letter-spacing: 0.08em;
  text-transform: none;
  box-shadow: none !important;
  padding: 0 !important;
}

/* —— 42 格主体：用行高与列宽形成秩序，不用格线 —— */
.mymemo-cal :deep(.vuecal__cells) {
  gap: 0 !important;
  background: transparent !important;
  background-image: none !important;
  border: none !important;
  box-shadow: none !important;
}
.mymemo-cal :deep(.vuecal__cell) {
  background: transparent !important;
  background-image: none !important;
  border: none !important;
  box-shadow: none !important;
  min-height: var(--cal-cell-h, 46px) !important;
  position: relative;
  padding: 0 !important;
  border-radius: 0 !important;
}
.mymemo-cal :deep(.vuecal__cell::before) {
  display: none !important;
  border: none !important;
}
.mymemo-cal :deep(.vuecal__cell--today),
.mymemo-cal :deep(.vuecal__cell--current),
.mymemo-cal :deep(.vuecal__cell--selected),
.mymemo-cal :deep(.vuecal__cell--highlighted) {
  background: transparent !important;
}
.mymemo-cal :deep(.vuecal__cell-content) {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

/* —— 日期数字：默认无底色，用排版和留白建立月历结构 —— */
.vc-cell-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 0;
  gap: 3px;
}
.vc-day-num {
  position: relative;
  width: 32px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 12px;
  font-weight: var(--font-medium);
  background: transparent;
  color: var(--color-text-primary);
  user-select: none;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.vc-day-num:hover {
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
}
/* —— 跨月日期：降低存在感，但不制造另一层格子 —— */
.vc-day-num.is-weekday-outside {
  color: var(--color-text-placeholder);
  opacity: 0.72;
}
/* —— Today：单点强调，不恢复整格背景 —— */
.vc-day-num.is-today {
  background: var(--color-accent);
  color: var(--color-text-on-gradient);
  font-weight: var(--font-bold);
  box-shadow: 0 2px 5px color-mix(in srgb, var(--color-accent) 20%, transparent);
}
.vc-day-num.is-today:hover {
  background: color-mix(in srgb, var(--color-accent) 88%, black);
}
/* —— 选中：柔和底色 + 细边界，仅突出当前操作目标 —— */
.vc-day-num.is-selected {
  background: color-mix(in srgb, var(--color-accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent) 45%, transparent);
  color: var(--color-text-primary);
  font-weight: var(--font-semibold);
}
/* —— Today 同时被选中：Today 的实心强调优先 —— */
.vc-day-num.is-today.is-selected {
  background: var(--color-accent);
  border-color: transparent;
  color: var(--color-text-on-gradient);
}

/* —— 事件 indicator：日期下方 1–3 个小圆点 —— */
.vc-indicators {
  display: flex;
  gap: 3px;
  align-items: center;
  justify-content: center;
  height: 6px;                        /* 原 8px → 6px */
}
.vc-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  display: block;
  flex: 0 0 auto;
}
.vc-cell-inner:has(.vc-day-num.is-selected) .vc-dot {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 22%, transparent);
}

/* —— 时间块色块层：贴在格子底部，横跨 1~N 天，多泳道上下错开 —— */
.vc-dur-layer {
  position: absolute;
  left: 2px;
  right: 2px;
  bottom: 2px;
  height: 9px;
  pointer-events: none;               /* 不干扰日期单选 / 双击；双击由 cell 本身接收 */
}
.vc-dur-bar {
  position: absolute;
  left: 1px;
  right: 1px;
  height: 7px;
  top: calc(var(--lane, 0) * 10px);
  border-radius: 3px;
  border: 1px solid;
  opacity: 0.9;
  box-sizing: border-box;
}
/* 单日块：整体椭圆胶囊 */
.vc-dur-bar.is-single {
  border-radius: 999px;
}
/* 区间：起始日左侧圆角、结束日右侧圆角，中间平整 → 连成一根带 */
.vc-dur-bar.is-start {
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}
.vc-dur-bar.is-end {
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}
/* 选择模式：预览块加粗、加高亮描边 */
.vc-dur-bar.is-preview {
  height: 9px;
  top: max(calc(calc(var(--lane, 0) * 10px) - 1px), 0px);
  opacity: 1;
  outline: 1px solid var(--color-accent);
  z-index: 2;
}
/* 可设置结束日期的时间块（无结束日期）：悬浮该日期格时光块轻微加深/高亮，提示可操作 */
.vc-cell-inner.is-routable-start .vc-dur-bar {
  filter: brightness(1.02);
}
.vc-cell-inner.is-routable-start:hover .vc-dur-bar {
  filter: brightness(1.18) saturate(1.12);
  outline: 1px solid color-mix(in srgb, var(--color-accent) 55%, transparent);
  z-index: 2;
}

/* —— 「显示时间块」开关 + 选择提示 —— */
.cal-dur-toggle-row {
  margin-top: 6px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-height: 20px;
}
.cal-dur-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  user-select: none;
}
.cdt-track {
  position: relative;
  width: 26px;
  height: 15px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 14%, var(--glass-border));
  border: 1px solid var(--glass-border);
  transition: background var(--duration-fast) var(--ease-out);
  flex: 0 0 auto;
}
.cdt-knob {
  position: absolute;
  top: 50%;
  left: 2px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--color-text-tertiary);
  transform: translateY(-50%);
  transition:
    left var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);
}
.cal-dur-toggle.on .cdt-track {
  background: var(--color-accent);
  border-color: color-mix(in srgb, var(--color-accent) 60%, transparent);
}
.cal-dur-toggle.on .cdt-knob {
  left: 12px;
  background: var(--color-text-on-gradient);
}
.cdt-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
}
.cdt-hint {
  font-size: 10px;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: var(--font-medium);
}

/* —— 选中日期当天事件列表（整体收紧，和小日历视觉对齐）—— */
.day-events {
  margin-top: 8px;                    /* 原 12px → 8px */
  padding-top: 8px;                   /* 原 12px → 8px */
  border-top: 1px dashed color-mix(in srgb, var(--color-accent) 22%, var(--glass-border));
  display: flex;
  flex-direction: column;
  gap: 6px;                           /* 原 10px → 6px */
}
.day-events-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.day-events-date {
  font-size: 12px;                    /* 原 text-sm≈13px → 12px */
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.day-events-weekday {
  margin-left: 5px;                   /* 原 6px → 5px */
  color: var(--color-text-tertiary);
  font-weight: var(--font-medium);
  font-size: 10px;                    /* 原 11px → 10px */
}
.day-events-count {
  font-size: 10px;                    /* 原 11px → 10px */
  font-weight: var(--font-semibold);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  padding: 1.5px 7px;                 /* 原 2px 8px → 1.5px 7px */
  border-radius: 999px;
}
.day-events-list {
  display: flex;
  flex-direction: column;
  gap: 5px;                           /* 原 6px → 5px */
}
.day-event-row {
  display: flex;
  align-items: center;
  gap: 8px;                           /* 原 10px → 8px */
  padding: 6px 8px;                   /* 原 8px 10px → 6px 8px，收窄行高 */
  border-radius: 8px;                 /* 原 10px → 8px */
  background: var(--surface-bg);
  border: 1px solid var(--surface-border);
  font-size: 11px;                    /* 原 12px → 11px */
  cursor: pointer;                    /* 整行可点击进入编辑 */
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.day-event-row:hover {
  background: var(--glass-bg-hover);
  border-color: color-mix(in srgb, var(--color-primary) 16%, var(--surface-border));
  transform: translateX(1px);
}
.day-event-type-dot {
  width: 5px;                         /* 原 7px → 5px */
  height: 5px;
  border-radius: 50%;
  flex: 0 0 auto;
}
.day-event-time {
  color: var(--color-text-tertiary);
  font-size: 10px;                    /* 原 11px → 10px */
  min-width: 68px;                    /* 原 78px → 68px */
  font-variant-numeric: tabular-nums;
}
.day-event-title {
  color: var(--color-text-primary);
  font-weight: var(--font-medium);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.day-events-empty {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--color-text-tertiary);
  font-size: 11px;                    /* 原 12px → 11px */
  padding: 6px 2px;                   /* 原 8px 2px → 6px 2px */
}
.empty-icon {
  color: var(--color-text-tertiary);
  opacity: 0.7;
  font-size: 14px;                    /* 原 16px → 14px */
  line-height: 1;
}

/* —— 小屏 (<520px) 进一步压缩 —— */
@media (max-width: 520px) {
  .calendar-wrap { width: 100%; }
  .mymemo-cal { --cal-cell-h: 40px; }
  .mymemo-weekdays { margin-bottom: 6px; font-size: 9px; }
  .vc-day-num { width: 28px; height: 28px; font-size: 11px; border-radius: 9px; }
  .vc-dot { width: 3px; height: 3px; }
  .vc-indicators { gap: 1.5px; height: 5px; }
}

/* ==============================================================================
 *  CRUD UI 样式
 * ============================================================================== */

/* —— .cal-host：不再需要作为 FAB 的定位容器，移除 relative 以避免层级副作用 —— */
.cal-host {
  z-index: 1;
}

/* —— 顶部新增「+」按钮：完全复用原 FAB（右下角）的玻璃质感，只是尺寸更小，融入 header 行 ——
 *  · 玻璃背景 = --glass-bg (= db-chip 背景)
 *  · 毛玻璃模糊/饱和度 = --glass-blur / --glass-saturate (= db-chip backdrop 同源)
 *  · 边框 = --glass-border (= db-chip 边框，1px 半透明暖灰)
 *  · 圆角 = --glass-radius (= db-chip 圆角 16px，取相同温度感)
 *  · 阴影 = var(--glass-shadow) + var(--glass-highlight) (= db-chip 双重阴影：柔和投影 + 顶光)
 *  · 尺寸 28×28，内部「+」居中，与 today 按钮视觉高度匹配
 */
.cal-add-btn {
  position: relative;
  margin-left: 4px;                    /* 与「今天」按钮之间留出呼吸感 */
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: min(var(--glass-radius, 16px), 10px);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    filter var(--duration-fast) var(--ease-out);
}
.cal-add-btn:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  box-shadow: var(--glass-shadow-hover), var(--glass-highlight);
  color: var(--color-primary);
  transform: translateY(-1px) scale(1.04);
  filter: brightness(1.03);
}
.cal-add-btn:active {
  transform: translateY(0) scale(0.98);
  filter: brightness(0.98);
}

/* —— 原右下角 FAB 样式保留（暂不删除，避免其他引用）—— */
.cal-fab {
  position: absolute;
  right: 10px;
  bottom: 6px;
  z-index: 3;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: min(var(--glass-radius, 16px), 12px);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    filter var(--duration-fast) var(--ease-out);
  opacity: 0;                     /* 已弃用：彻底隐藏，避免旧样式被意外复用 */
  pointer-events: none;
}
.cal-fab:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  box-shadow: var(--glass-shadow-hover), var(--glass-highlight);
  color: var(--color-primary);
  transform: translateY(-1px) scale(1.04);
  filter: brightness(1.03);
}
.cal-fab:active {
  transform: translateY(0) scale(0.98);
  filter: brightness(0.98);
}

/* —— 事件列表「编辑 / 删除」操作按钮：行尾出现（hover 或常驻，此处做常驻避免小屏看不见）—— */
.day-event-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  margin-left: auto;
  opacity: 0;
  transform: translateX(4px);
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.day-event-row:hover .day-event-actions,
.day-event-row:focus-within .day-event-actions {
  opacity: 1;
  transform: translateX(0);
}
.de-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-text-tertiary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}
.de-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
}
.de-btn--danger:hover {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger-light);
  border-color: color-mix(in srgb, var(--color-danger) 28%, transparent);
}

/* ==============================================================================
 *  时间块结束日期确认弹窗（Teleport 到 body，玻璃风格与 BaseConfirmDialog 同源）
 * ============================================================================== */
.dur-confirm-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: color-mix(in srgb, var(--color-primary) 18%, rgba(255, 255, 255, 0.30));
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}
.dur-confirm-dialog {
  width: min(100%, 320px);
  padding: 16px 18px;
  background: var(--glass-bg-active);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  display: grid;
  grid-template-columns: 30px 1fr;
  gap: 4px 10px;
  align-items: start;
}
.dur-confirm-mark {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 26%, transparent);
}
.dur-confirm-copy {
  min-width: 0;
}
.dur-confirm-title {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: var(--font-semibold);
  line-height: 1.35;
}
.dur-confirm-event {
  margin: 7px 0 0;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: var(--font-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dur-confirm-hint {
  margin: 4px 0 0;
  color: var(--color-text-tertiary);
  font-size: 11px;
}
.dur-confirm-actions {
  grid-column: 2;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

/* 复用 BaseConfirmDialog 的淡入淡出过渡名，视觉一致 */
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}
.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}
</style>

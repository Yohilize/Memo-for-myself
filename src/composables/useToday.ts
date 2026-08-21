import dayjs from 'dayjs'
import { ref } from 'vue'

/**
 * useToday — 全局共享、跨午夜自动刷新的「今天」日期（YYYY-MM-DD）。
 *
 * 供 Dashboard / 事件全览 / 置顶事件等状态展示统一使用：
 * 派生状态基于 todayKey 计算，页面常驻跨天时 todayKey 自动更新，
 * 派生状态随之重算，无需刷新页面，也不把派生态写回数据库。
 */
const todayKey = ref(dayjs().format('YYYY-MM-DD'))
let started = false

function refresh() {
  const k = dayjs().format('YYYY-MM-DD')
  if (k !== todayKey.value) todayKey.value = k
}

/** 惰性启动：首个组件使用时才挂计时器与可见性刷新（SPA 单例，避免多个定时器）。 */
function ensureTodayTimer() {
  if (started) return
  started = true
  setInterval(refresh, 60_000)
  // 页面重新可见时立即校准，避免后台切回后仍显示旧日期
  document.addEventListener('visibilitychange', refresh)
}

export function useToday() {
  ensureTodayTimer()
  return { todayKey }
}
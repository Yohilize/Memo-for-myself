/**
 * localStorage 键集中管理。
 *
 * 数据导入 / 导出与各业务模块必须使用同一组键，避免字面量漂移导致数据错位。
 * 键名带 .v1 后缀 → 未来结构变化时新增 .v2 键并做迁移，不要原地改结构。
 * 这里的键是「用户运行时数据」清单，也是导出 / 导入的唯一白名单。
 */
export const STORAGE_KEYS = {
  /** Dashboard Widget 布局（JSON 字符串） */
  dashboardWidgetLayout: 'mymemo.dashboard.widget-layout.v1',
  /** Dashboard 固定事件 ID（字符串；空 / 缺省表示未固定） */
  dashboardPinnedEvent: 'mymemo.dashboard.pinned-event.v1',
  /** Calendar「时间块」显示开关（'1' 表示开启；缺省 / 移除表示关闭） */
  calShowDurationBlocks: 'mymemo.cal.show-duration-blocks.v1',
  /** Design Lab 临时视觉 Token（JSON 字符串） */
  designLabTokens: 'mymemo-design-lab-tokens',
} as const

export type StorageKeyName = keyof typeof STORAGE_KEYS

/** 全部已知键的值（导出 / 导入白名单） */
export const STORAGE_KEY_VALUES: readonly string[] = Object.values(STORAGE_KEYS)

export function isKnownStorageKey(key: string): boolean {
  return (STORAGE_KEY_VALUES as readonly string[]).includes(key)
}

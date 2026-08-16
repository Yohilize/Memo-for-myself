import type { BackgroundSettings } from '@/db/database'

/**
 * BackgroundSettings Repository 接口：固定背景配置的持久化读写。
 * UI / Store 依赖此接口，不关心底层是 IndexedDB 还是远程 API。
 * 未来切换到动态后端时只需要新增一个实现类即可。
 */
export interface IBackgroundRepository {
  /** 读取当前固定背景配置；不存在时返回 undefined（由上层回退到默认值） */
  get(): Promise<BackgroundSettings | undefined>
  /** 整体覆写固定背景配置（始终 upsert 到单条 id='default' 记录） */
  save(settings: Omit<BackgroundSettings, 'id' | 'updatedAt'>): Promise<BackgroundSettings>
  /** 清除固定背景（恢复为零壁纸 + tokens.css 默认参数） */
  clear(): Promise<void>
}

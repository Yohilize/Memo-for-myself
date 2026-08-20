import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { imageWidgetRepository } from '@/repositories'
import type { ImageWidgetRecord } from '@/db/database'

/**
 * 图片小组件 Store —— Dashboard 上的「图片」小组件数据的唯一真源。
 *
 * 记录存裁剪后的 base64 DataURL（与背景壁纸同一持久化方案）。保存 / 删除时，
 * 负责同步维护内存里的 records 数组与 IndexedDB，供 DashboardWidgetArea 响应式渲染。
 *
 * 注意：布局（位置 / 尺寸 / 顺序）不在此 Store 中，由 useDashboardWidgetLayout 管理；
 * 两者通过「记录主键 id = 布局 key」关联。删除组件时需同时调用两处。
 */
export const useImageWidgetStore = defineStore('imageWidgets', () => {
  const records = ref<ImageWidgetRecord[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** 启动 / 刷新时从 IndexedDB 读取全部图片组件记录 */
  async function loadAll() {
    loading.value = true
    error.value = null
    try {
      records.value = await imageWidgetRepository.getAll()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load image widgets'
    } finally {
      loading.value = false
    }
  }

  /**
   * 新增一条图片组件记录，返回其 id。
   * 调用方拿到 id 后，再把它放到 Dashboard Grid 的布局里。
   */
  async function create(
    dataUrl: string,
  ): Promise<{ record: ImageWidgetRecord; id: string }> {
    error.value = null
    const now = new Date().toISOString()
    const record: ImageWidgetRecord = {
      id: uuidv4(),
      dataUrl,
      created_at: now,
      updated_at: now,
    }
    try {
      await imageWidgetRepository.create(record)
      records.value.unshift(record)
      return { record, id: record.id }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create image widget'
      throw e
    }
  }

  /** 删除一条图片组件记录，同时清理其图片数据 */
  async function remove(id: string) {
    error.value = null
    try {
      await imageWidgetRepository.delete(id)
      records.value = records.value.filter((r) => r.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete image widget'
      throw e
    }
  }

  return {
    records,
    loading,
    error,
    loadAll,
    create,
    remove,
  }
})
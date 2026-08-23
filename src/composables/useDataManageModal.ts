import { ref } from 'vue'

/**
 * 数据管理弹窗（DataManageModal）的全局开关。
 * 模块级单例响应式，供 AppSidebar（打开）与 DataManageModal（渲染/关闭）共享，
 * 无需在 AppSidebar 到各视图之间逐层透传事件。
 */
const visible = ref(false)

export function useDataManageModal() {
  function open(): void {
    visible.value = true
  }
  function close(): void {
    visible.value = false
  }
  return { visible, open, close }
}

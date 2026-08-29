<script setup lang="ts">
import { RouterView } from 'vue-router'
import BackgroundLayer from '@/components/layout/BackgroundLayer.vue'
import DataManageModal from '@/components/dashboard/DataManageModal.vue'
import EventForm from '@calendar/EventForm.vue'
import EventEditPanel from '@/components/events/EventEditPanel.vue'
import BaseConfirmDialog from '@/components/base/BaseConfirmDialog.vue'
import { useEventWindowStore } from '@/stores/eventWindowStore'

// —— 全项目统一「新增 / 编辑事件窗口」：App.vue 唯一持有，跨路由存活 —— //
const eventWindow = useEventWindowStore()
</script>

<template>
  <BackgroundLayer />
  <main class="app-content">
    <RouterView />
  </main>
  <DataManageModal />

  <!-- ===== 全局事件窗口：以「仪表盘日历 +」的 large 版本作为全项目标准 =====
       所有入口仅调用 eventWindow.openCreate / openEdit 传上下文；新增、编辑、删除逻辑统一在此。
       EventForm 内部 Teleport 到 body，故挂载位置不影响层级。 -->
  <EventForm
    v-model:visible="eventWindow.visible"
    :default-type="eventWindow.defaultType"
    :default-date="eventWindow.defaultDate || undefined"
    :editing-event="eventWindow.editingEvent"
    size-variant="large"
    @submit-create="eventWindow.submitCreate"
    @submit-update="eventWindow.submitUpdate"
    @delete="eventWindow.requestDelete"
  />
  <!-- ===== 全局事件编辑面板：所有页面「点击事件进入编辑」统一在此 =====
       只传 eventId，面板内部按 id 从 Store 实时解析最新事件；新增窗口（EventForm）不受影响。
       说明：EventForm 现有 `editingEvent` 提交分支虽保留，openEdit 已改走本面板，
       EventForm 仅承担「新增」；但本面板是唯一编辑宿主。 -->
  <EventEditPanel
    :visible="eventWindow.editVisible"
    :event-id="eventWindow.editEventId"
    @close="eventWindow.closeEdit"
  />
  <!-- 全局删除确认：仅用于事件窗口底部删除按钮；列表行内删除仍走各自页面弹窗 -->
  <BaseConfirmDialog
    :visible="!!eventWindow.deleteTarget"
    :event-title="eventWindow.deleteTarget?.title ?? ''"
    @cancel="eventWindow.cancelDelete"
    @confirm="eventWindow.confirmDelete"
  />
</template>

<style scoped>
.app-content {
  position: relative;
  z-index: var(--z-content);
  height: 100%;
}
</style>

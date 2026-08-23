<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { dataTransferService } from '@/services/dataTransferService'
import type {
  ImportStrategy,
  ImportResult,
  ImportSummary,
  MyMemoExport,
} from '@/services/dataTransferService'
import { STORAGE_KEYS } from '@/services/storageKeys'
import { useDataManageModal } from '@/composables/useDataManageModal'

/**
 * 数据管理弹窗（Dashboard 左下角入口按钮打开）。
 *  · 导出：把全部用户数据打包为带版本号的 .json 文件下载到本地；
 *  · 导入：选择 .json 文件 → 先整体校验（失败则任何数据都不改）→
 *          选择「覆盖 / 合并」策略后写入，完成后自动刷新页面保证全量一致。
 *  100% Local-first：不经过任何服务器，不上传数据。
 */
const { visible, close } = useDataManageModal()

/** 已知 localStorage 键的友好名称（导入摘要用） */
const KEY_LABELS: Record<string, string> = {
  [STORAGE_KEYS.dashboardWidgetLayout]: '组件布局',
  [STORAGE_KEYS.dashboardPinnedEvent]: '固定事件',
  [STORAGE_KEYS.calShowDurationBlocks]: '时间块开关',
  [STORAGE_KEYS.designLabTokens]: '视觉设置',
}

/* ------------------------------- 导出状态 ------------------------------- */
const preview = ref<{
  events: number
  imageWidgets: number
  hasBackground: boolean
  localStorageCount: number
} | null>(null)
const exporting = ref(false)

async function refreshPreview(): Promise<void> {
  try {
    preview.value = await dataTransferService.getExportPreview()
  } catch (_err) {
    preview.value = null
  }
}

async function handleExport(): Promise<void> {
  if (exporting.value) return
  exporting.value = true
  try {
    const exportFile = await dataTransferService.exportData()
    dataTransferService.downloadJson(
      dataTransferService.exportFileName(),
      JSON.stringify(exportFile, null, 2),
    )
    await refreshPreview()
  } catch (_err) {
    // 导出失败不阻塞界面（本地读取异常）
  } finally {
    exporting.value = false
  }
}

/* ------------------------------- 导入状态 ------------------------------- */
const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref('')
const payload = ref<MyMemoExport | null>(null)
const summary = ref<ImportSummary | null>(null)
const importError = ref('')
const strategy = ref<ImportStrategy>('merge')
const overwriteAck = ref(false)
const importing = ref(false)
const result = ref<ImportResult | null>(null)

// 每次打开弹窗重置状态，并刷新「当前内容」预览
watch(visible, (v) => {
  if (!v) return
  fileName.value = ''
  payload.value = null
  summary.value = null
  importError.value = ''
  strategy.value = 'merge'
  overwriteAck.value = false
  result.value = null
  void refreshPreview()
})

function pickFile(): void {
  fileInput.value?.click()
}

async function handleFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name
  importError.value = ''
  result.value = null
  summary.value = null
  payload.value = null

  try {
    const text = await file.text()
    const parsed = dataTransferService.parseExportFile(text)
    if (!parsed.ok) {
      importError.value = parsed.error
      return
    }
    payload.value = parsed.payload
    summary.value = dataTransferService.summarizePayload(parsed.payload)
  } catch (_err) {
    importError.value = '无法读取该文件'
  } finally {
    // 允许重复选择同一个文件（清空 input 的 value 才能再次触发 change）
    input.value = ''
  }
}

const summaryLabel = computed(() => {
  if (!summary.value || summary.value.localStorageKeys.length === 0) return '无'
  return summary.value.localStorageKeys.map((key) => KEY_LABELS[key] ?? key).join('、')
})

async function handleImport(): Promise<void> {
  if (!payload.value || importing.value) return
  if (strategy.value === 'overwrite' && !overwriteAck.value) return
  importing.value = true
  importError.value = ''
  try {
    result.value = await dataTransferService.importData(payload.value, strategy.value)
    // 数据已写入 IndexedDB / localStorage；刷新页面让所有 Store 与 composable 一次性对齐
    window.setTimeout(() => window.location.reload(), 1400)
  } catch (err) {
    importError.value = err instanceof Error ? err.message : '导入失败'
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dm-fade">
      <div
        v-if="visible"
        class="dm-mask"
        role="presentation"
        @click.self="close"
      >
        <section
          class="dm-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="数据管理"
        >
          <header class="dm-head">
            <div>
              <h2 class="dm-title">数据管理</h2>
              <p class="dm-sub">导入 / 导出 MYMEMO 全部数据，仅保存在本机</p>
            </div>
            <button
              class="dm-close"
              type="button"
              aria-label="关闭"
              @click="close"
            >×</button>
          </header>

          <!-- ===== 导出 ===== -->
          <section class="dm-section">
            <h3 class="dm-section-title">导出数据</h3>
            <p class="dm-desc">
              将全部数据打包为 <code>.json</code> 文件（事件 / 背景 / 图片组件 / 本地设置），可随时重新导入。
            </p>
            <div v-if="preview" class="dm-preview">
              当前包含：<b>{{ preview.events }}</b> 个事件 ·
              <b>{{ preview.imageWidgets }}</b> 个图片组件 ·
              背景：{{ preview.hasBackground ? '有' : '无' }} ·
              <b>{{ preview.localStorageCount }}</b> 项本地设置
            </div>
            <div class="dm-actions">
              <BaseButton
                variant="primary"
                size="sm"
                :disabled="exporting"
                @click="handleExport"
              >
                {{ exporting ? '导出中…' : '导出全部数据' }}
              </BaseButton>
            </div>
          </section>

          <!-- ===== 导入 ===== -->
          <section class="dm-section">
            <h3 class="dm-section-title">导入数据</h3>
            <p class="dm-desc">
              选择 MYMEMO 导出的 <code>.json</code> 文件。导入前会先校验结构与版本，校验失败不会修改任何数据。
            </p>

            <input
              ref="fileInput"
              type="file"
              accept="application/json,.json"
              class="dm-file-input"
              @change="handleFileChange"
            />
            <div class="dm-actions">
              <BaseButton variant="secondary" size="sm" @click="pickFile">
                选择文件
              </BaseButton>
              <span v-if="fileName" class="dm-file-name" :title="fileName">{{ fileName }}</span>
            </div>

            <!-- 校验失败 -->
            <p v-if="importError" class="dm-error" role="alert">
              导入失败：{{ importError }}（未修改任何数据）
            </p>

            <!-- 校验通过 → 摘要 + 策略 -->
            <div v-if="summary" class="dm-summary">
              <div class="dm-summary-row">
                事件 {{ summary.events }} 个 · 图片组件 {{ summary.imageWidgets }} 个 ·
                背景 {{ summary.hasBackground ? '有' : '无' }}
              </div>
              <div class="dm-summary-row">
                将写入本地设置：{{ summaryLabel }}
              </div>

              <div class="dm-strategy">
                <label class="dm-radio">
                  <input v-model="strategy" type="radio" value="merge" />
                  <span class="dm-radio-body">
                    <b>合并到现有数据</b>
                    <small>只补充文件中不存在的事件 / 图片组件；现有内容与未涉及的设置保持不变（推荐）</small>
                  </span>
                </label>
                <label class="dm-radio">
                  <input v-model="strategy" type="radio" value="overwrite" />
                  <span class="dm-radio-body">
                    <b>覆盖现有数据</b>
                    <small>清空并替换全部事件 / 图片组件 / 背景，并覆盖文件中包含的本地设置</small>
                  </span>
                </label>
              </div>

              <label v-if="strategy === 'overwrite'" class="dm-check">
                <input v-model="overwriteAck" type="checkbox" />
                <span>我确认用文件内容覆盖当前数据，此操作不可撤销</span>
              </label>

              <div class="dm-actions">
                <BaseButton
                  variant="primary"
                  size="sm"
                  :disabled="importing || (strategy === 'overwrite' && !overwriteAck)"
                  @click="handleImport"
                >
                  {{ importing ? '导入中…' : strategy === 'overwrite' ? '确认覆盖' : '确认导入' }}
                </BaseButton>
              </div>
            </div>

            <!-- 导入完成 -->
            <div v-if="result" class="dm-result" role="status">
              <p class="dm-result-title">导入完成</p>
              <p class="dm-result-detail">
                <template v-if="result.strategy === 'overwrite'">
                  已覆盖现有数据。
                </template>
                <template v-else>
                  新增 {{ result.eventsAdded }} 个事件（跳过 {{ result.eventsSkipped }} 个重复）、
                  {{ result.imageWidgetsAdded }} 个图片组件（跳过 {{ result.imageWidgetsSkipped }} 个重复）。
                </template>
              </p>
              <p class="dm-result-hint">正在刷新页面以应用所有数据…</p>
            </div>
          </section>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 视觉沿用 MYMEMO 玻璃面板规范（与 ComponentPickerModal / BaseConfirmDialog 一致） */
.dm-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: color-mix(in srgb, var(--color-primary) 18%, rgba(255, 255, 255, 0.3));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.dm-dialog {
  width: min(100%, 460px);
  max-height: min(84vh, 720px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  overflow-y: auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  background: var(--glass-bg);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}
.dm-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.dm-title {
  margin: 0;
  font-size: 14px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.dm-sub {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.dm-close {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.dm-close:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text-primary);
}

/* 分区卡片 */
.dm-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  background: var(--surface-bg);
}
.dm-section-title {
  margin: 0;
  font-size: 12px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.dm-desc {
  margin: 0;
  font-size: 10px;
  line-height: 1.6;
  color: var(--color-text-tertiary);
}
.dm-desc code {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  color: var(--color-accent);
}
.dm-preview {
  font-size: 10px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.dm-preview b {
  color: var(--color-text-primary);
}
.dm-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dm-file-input {
  display: none;
}
.dm-file-name {
  min-width: 0;
  overflow: hidden;
  font-size: 10px;
  color: var(--color-text-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 校验失败 */
.dm-error {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger-light);
  font-size: 11px;
  line-height: 1.6;
}

/* 校验通过 → 摘要 + 策略 */
.dm-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dm-summary-row {
  font-size: 11px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.dm-strategy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dm-radio {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);
}
.dm-radio:has(input:checked) {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--surface-border));
  background: var(--glass-bg-hover);
}
.dm-radio input {
  margin-top: 2px;
  accent-color: var(--color-primary);
}
.dm-radio-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dm-radio-body b {
  font-size: 11px;
  color: var(--color-text-primary);
}
.dm-radio-body small {
  font-size: 10px;
  line-height: 1.5;
  color: var(--color-text-tertiary);
}
.dm-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--color-danger-light);
}
.dm-check input {
  accent-color: var(--color-danger);
}

/* 导入完成 */
.dm-result {
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
}
.dm-result-title {
  margin: 0;
  font-size: 12px;
  font-weight: var(--font-semibold);
  color: var(--color-success-light);
}
.dm-result-detail {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--color-text-primary);
}
.dm-result-hint {
  margin: 4px 0 0;
  font-size: 10px;
  color: var(--color-text-tertiary);
}

.dm-fade-enter-active,
.dm-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}
.dm-fade-enter-from,
.dm-fade-leave-to {
  opacity: 0;
}
</style>

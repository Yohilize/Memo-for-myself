<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * 组件选择 GUI（编辑模式下点击「+」打开）。
 * 列出可添加的 Dashboard 组件，每个含预览、名称、功能描述；
 * 注册表用数组维护，后续新增组件只需在 COMPONENTS 中追加一项。
 */
export interface ComponentDef {
  /** 组件类型标识，父组件据此分发创建流程 */
  type: string
  /** 展示名称 */
  name: string
  /** 功能描述 */
  description: string
  /** 预览图标 key（内建几种简单图案，避免额外资源） */
  preview: 'image' | string
}

const COMPONENTS: ComponentDef[] = [
  {
    type: 'image',
    name: '图片',
    description: '上传并展示一张本地图片，占 1×1 格；可在调整界面拖动与缩放。',
    preview: 'image',
  },
]

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (event: 'cancel'): void
  (event: 'select', type: string): void
}>()

const activeType = ref('image')

// 打开时默认选中第一项；选中态仅供视觉强调，点击任一卡片即可选择
watch(
  () => props.visible,
  (visible) => {
    if (visible && COMPONENTS.length > 0) {
      activeType.value = COMPONENTS[0].type
    }
  },
)

function choose(type: string): void {
  emit('select', type)
}

function cancel(): void {
  emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pk-fade">
      <div
        v-if="visible"
        class="pk-mask"
        role="presentation"
        @click.self="cancel"
      >
        <section
          class="pk-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="添加组件"
        >
          <header class="pk-head">
            <div>
              <h2 class="pk-title">添加组件</h2>
              <p class="pk-sub">选择要添加到仪表盘的小组件</p>
            </div>
            <button
              class="pk-close"
              type="button"
              aria-label="关闭"
              @click="cancel"
            >
              ×
            </button>
          </header>

          <ul class="pk-list">
            <li
              v-for="item in COMPONENTS"
              :key="item.type"
              class="pk-item"
              :class="{ 'is-active': activeType === item.type }"
              role="button"
              tabindex="0"
              @click="choose(item.type)"
              @keydown.enter="choose(item.type)"
            >
              <div class="pk-preview pk-preview--image" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/></svg>
              </div>
              <div class="pk-info">
                <span class="pk-name">{{ item.name }}</span>
                <span class="pk-desc">{{ item.description }}</span>
              </div>
              <span class="pk-chevron" aria-hidden="true">›</span>
            </li>
          </ul>

          <footer class="pk-actions">
            <button class="pk-cancel" type="button" @click="cancel">取消</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pk-mask {
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
.pk-dialog {
  width: min(100%, 420px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  background: var(--glass-bg);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}
.pk-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.pk-title {
  margin: 0;
  font-size: 14px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.pk-sub {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.pk-close {
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
.pk-close:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text-primary);
}
.pk-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pk-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  background: var(--surface-bg);
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}
.pk-item:hover {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--surface-border));
  background: var(--glass-bg-hover);
  transform: translateY(-1px);
}
.pk-item.is-active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent);
}
.pk-preview {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--color-accent-2);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-accent-2) 22%, transparent),
    color-mix(in srgb, var(--color-accent) 16%, transparent)
  );
}
.pk-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.pk-name {
  font-size: 12px;
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}
.pk-desc {
  font-size: 10px;
  line-height: 1.5;
  color: var(--color-text-tertiary);
}
.pk-chevron {
  margin-left: auto;
  color: var(--color-text-tertiary);
  font-size: 16px;
}
.pk-actions {
  display: flex;
  justify-content: flex-end;
}
.pk-cancel {
  height: 28px;
  padding: 0 14px;
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 11px;
  cursor: pointer;
}
.pk-cancel:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text-primary);
}
.pk-fade-enter-active,
.pk-fade-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}
.pk-fade-enter-from,
.pk-fade-leave-to {
  opacity: 0;
}
</style>
<script setup lang="ts">
/**
 * BackgroundLayer —— 独立的背景层组件。
 *
 * 🔴 关键隔离机制（DSL 临时编辑状态 vs 正式固定背景）：
 *  - 壁纸 src + 8 个背景参数（offset/scale/opacity/blur/mask/orbOpacity）
 *    只从 useFixedBackgroundStore 读取，**绝不**从 DSL 的 useTokenControls 中读取。
 *  - 颜色 / 玻璃 / 光球色 / 背景渐变 仍走全局 CSS var（useTokenControls 立即生效），
 *    不属于「固定背景」机制的管控范围。
 *
 * 隔离的实现：在根元素 .bg-layer 上通过 :style 为 8 个背景相关 CSS var
 * 重新赋值为 fixedStore 的当前值 → 因为 CSS 自定义属性继承，所有子元素
 * 读取到的 var(--bg-image-opacity) 等就是固定值，
 * 而不是 useTokenControls applyTokens() 写到 documentElement 的临时值。
 */
import { computed } from 'vue'
import { useFixedBackgroundStore } from '@/stores'

const fb = useFixedBackgroundStore()

const wallpaperSrc = computed(() => fb.wallpaperDataUrl || '')

/** 把固定背景参数作为局部 CSS var 写到根元素，覆盖全局的 DSL 临时值 */
const rootStyle = computed<Record<string, string>>(() => ({
  '--bg-offset-x': `${fb.bgOffsetX}px`,
  '--bg-offset-y': `${fb.bgOffsetY}px`,
  '--bg-scale': String(fb.bgScale),
  '--bg-image-opacity': String(fb.bgImageOpacity),
  '--bg-image-blur': `${fb.bgImageBlur}px`,
  '--bg-mask-opacity': String(fb.bgMaskOpacity),
  '--bg-orb-opacity': String(fb.bgOrbOpacity),
}))
</script>

<template>
  <div class="bg-layer" aria-hidden="true" :style="rootStyle">
    <div class="bg-gradient"></div>
    <div class="bg-orb bg-orb-1"></div>
    <div class="bg-orb bg-orb-2"></div>
    <div class="bg-orb bg-orb-3"></div>

    <!-- 真实 <img>：min-cover + transform(offset/scale)
         —— 与 DSL 预览模型一致，但参数来自 fixedStore（而不是 DSL 临时 state） -->
    <div class="bg-image-wrap">
      <img v-if="wallpaperSrc" class="bg-image-img"
        :src="wallpaperSrc" alt="" draggable="false" />
    </div>

    <div class="bg-mask"></div>
    <div class="bg-noise"></div>
  </div>
</template>

<style scoped>
.bg-layer {
  position: fixed;
  inset: 0;
  z-index: var(--z-background);
  overflow: hidden;
  pointer-events: none;
}

.bg-gradient {
  position: absolute;
  inset: 0;
  background: var(--bg-gradient);
}

.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(var(--bg-orb-blur));
  opacity: var(--bg-orb-opacity);
  will-change: transform;
}

.bg-orb-1 {
  width: 420px;
  height: 420px;
  background: var(--bg-orb-color-1);
  top: -110px;
  left: -40px;
  animation: float-1 15s ease-in-out infinite;
}
.bg-orb-2 {
  width: 360px;
  height: 360px;
  background: var(--bg-orb-color-2);
  bottom: -80px;
  right: -20px;
  animation: float-2 19s ease-in-out infinite;
}
.bg-orb-3 {
  width: 300px;
  height: 300px;
  background: var(--bg-orb-color-3);
  top: 42%;
  left: 58%;
  animation: float-3 17s ease-in-out infinite;
}

/* 背景图：min-cover + transform(offset/scale)
   注意：此处 var 的值来自 .bg-layer 的 inline style（fixedStore 固定值），
         不是 documentElement 上 DSL 临时写入的值。 */
.bg-image-wrap {
  position: absolute;
  inset: 0;
  overflow: hidden;
  opacity: var(--bg-image-opacity);
}
.bg-image-img {
  position: absolute;
  left: 50%;
  top: 50%;
  min-width: 100%;
  min-height: 100%;
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
  display: block;
  transform-origin: center center;
  transform:
    translate(-50%, -50%)
    translate(var(--bg-offset-x, 0px), var(--bg-offset-y, 0px))
    scale(var(--bg-scale, 1));
  filter: blur(var(--bg-image-blur, 0px));
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
}

.bg-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, var(--bg-mask-opacity));
}

.bg-noise {
  position: absolute;
  inset: 0;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

@keyframes float-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(30px, 25px) scale(1.06); }
  66%      { transform: translate(-18px, -16px) scale(0.96); }
}
@keyframes float-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(-28px, -22px) scale(1.04); }
  66%      { transform: translate(22px, 30px) scale(0.94); }
}
@keyframes float-3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-24px, 20px) scale(1.08); }
}

@media (prefers-reduced-motion: reduce) {
  .bg-orb { animation: none; }
}
</style>

<script setup lang="ts">
/**
 * BackgroundLayer
 * 独立的背景层组件。背景图采用真实 <img> + transform(offset/scale) 模型，
 * 图片本身不会被提前裁切，translate/scale 作用在完整像素上，
 * 与 Design Lab 中用户的拖拽/缩放操作一一对应。
 */
import { computed } from 'vue'
import { getWallpaper } from '../../design-lab/useTokenControls'
const wallpaperSrc = computed(() => getWallpaper())
</script>

<template>
  <div class="bg-layer" aria-hidden="true">
    <div class="bg-gradient"></div>
    <div class="bg-orb bg-orb-1"></div>
    <div class="bg-orb bg-orb-2"></div>
    <div class="bg-orb bg-orb-3"></div>

    <!-- 真实 <img>：min-cover（图片自身不被提前裁切），
         居中定位后再施加 --bg-offset-x/y 与 --bg-scale。
         translate(px) 时，原先在容器外的图像像素会真正"移动"到视口内，
         因此用户在 Design Lab 拖出来的构图 = 真实 MYMEMO 首页看到的构图。 -->
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

/* 背景图：真实 <img> + min-cover + transform(offset/scale)
   —— 核心：img 元素按自身比例保留全部像素，
      仅通过 min-width/min-height:100% 保证最小覆盖；
      translate 作用在完整的 img 元素上，所以"拖动"时
      原先在容器外的像素会真正进入视口。
      overflow:hidden 只裁剪容器可见区域，不影响图片本身。 */
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

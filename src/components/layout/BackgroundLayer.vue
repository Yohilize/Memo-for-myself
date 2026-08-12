<script setup lang="ts">
/**
 * BackgroundLayer
 * 独立的背景层组件。背景图采用真实 <img> + transform(offset/scale) 模型，
 * 与 Design Lab 中用户的拖拽/缩放操作一一对应。
 */
</script>

<template>
  <div class="bg-layer" aria-hidden="true">
    <div class="bg-gradient"></div>
    <div class="bg-orb bg-orb-1"></div>
    <div class="bg-orb bg-orb-2"></div>
    <div class="bg-orb bg-orb-3"></div>

    <!-- 真实 <img>：以 cover 为基准（min-width/min-height: 100%），
         居中定位后再施加 --bg-offset-x/y 与 --bg-scale，
         这样用户在 Design Lab 里拖出来的效果 = 未来真实 MYMEMO 里看到的效果。 -->
    <div class="bg-image-wrap">
      <img class="bg-image-img" alt=""
        :style="{ backgroundImage: 'var(--bg-image-url, none)' }" />
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

/* 背景图：真实 <img> + transform(offset/scale) */
.bg-image-wrap {
  position: absolute;
  inset: 0;
  overflow: hidden;
  opacity: var(--bg-image-opacity);
}
.bg-image-wrap::after {
  /* 用伪元素承载背景图，这样 background-size/position 可控，
     同时我们又能做 transform(offsetX/offsetY/scale) */
  content: '';
  position: absolute;
  /* 初始：居中 + cover（min 尺寸） */
  left: 50%;
  top: 50%;
  width: auto;
  height: auto;
  min-width: 100%;
  min-height: 100%;
  /* 背景图真正作为层叠背景渲染，便于响应容器实际尺寸 */
  background-image: var(--bg-image-url, none);
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
  /* 关键点：
     translate(-50%, -50%) = 对齐到图片中心 → 与容器中心重合
     translate(var(--bg-offset-x), var(--bg-offset-y)) = 用户的实时拖拽
     scale(var(--bg-scale)) = 用户的实时缩放
  */
  transform:
    translate(-50%, -50%)
    translate(var(--bg-offset-x, 0px), var(--bg-offset-y, 0px))
    scale(var(--bg-scale, 1));
  transform-origin: center center;
  filter: blur(var(--bg-image-blur, 0px));
  /* 尺寸 = 容器尺寸的 100% + scale 后会溢出；overflow:hidden 裁掉 */
  width: 100%;
  height: 100%;
}

.bg-image-img {
  display: none; /* 保留节点以防后续扩展，实际渲染用 ::after */
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

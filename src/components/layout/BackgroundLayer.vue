<script setup lang="ts">
/**
 * BackgroundLayer
 * 独立的背景层组件，管理渐变、光球动画、壁纸图片、遮罩。
 * 通过 CSS 变量接收配置，不引入任何业务逻辑。
 */
</script>

<template>
  <div class="bg-layer" aria-hidden="true">
    <div class="bg-gradient"></div>
    <div class="bg-orb bg-orb-1"></div>
    <div class="bg-orb bg-orb-2"></div>
    <div class="bg-orb bg-orb-3"></div>
    <div class="bg-image"></div>
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
  width: 400px;
  height: 400px;
  background: var(--bg-orb-color-1);
  top: -100px;
  left: -50px;
  animation: float-1 14s ease-in-out infinite;
}

.bg-orb-2 {
  width: 350px;
  height: 350px;
  background: var(--bg-orb-color-2);
  bottom: -80px;
  right: -30px;
  animation: float-2 18s ease-in-out infinite;
}

.bg-orb-3 {
  width: 300px;
  height: 300px;
  background: var(--bg-orb-color-3);
  top: 40%;
  left: 60%;
  animation: float-3 16s ease-in-out infinite;
}

.bg-image {
  position: absolute;
  inset: 0;
  background-image: var(--bg-image-url, none);
  background-size: cover;
  background-position: center;
  opacity: var(--bg-image-opacity);
  filter: blur(var(--bg-image-blur));
  transition: opacity var(--duration-slow) var(--ease-out);
}

.bg-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, var(--bg-mask-opacity));
}

.bg-noise {
  position: absolute;
  inset: 0;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

@keyframes float-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(40px, 30px) scale(1.08); }
  66% { transform: translate(-20px, -20px) scale(0.95); }
}

@keyframes float-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-35px, -25px) scale(1.05); }
  66% { transform: translate(25px, 35px) scale(0.92); }
}

@keyframes float-3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-30px, 25px) scale(1.1); }
}

@media (prefers-reduced-motion: reduce) {
  .bg-orb {
    animation: none;
  }
}
</style>

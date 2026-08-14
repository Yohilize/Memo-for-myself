import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      // MYMEMO 真正的主程序入口（src/），pnpm dev 默认打开 /
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
    },
    {
      // Design Lab：独立视觉调试工具（design-lab/），不作为默认首页
      path: '/design-lab',
      name: 'design-lab',
      component: () => import('@design-lab/DesignLabView.vue'),
    },
    {
      // Calendar：独立开发中的次程序（Calendar/），暂不集成进 src 主程序
      path: '/calendar',
      name: 'calendar',
      component: () => import('@calendar/CalendarView.vue'),
    },
    {
      // 数据持久化验证：保留为开发测试页
      path: '/data-test',
      name: 'data-test',
      component: () => import('@/views/DataTestView.vue'),
    },
  ],
})

export default router

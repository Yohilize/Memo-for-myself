import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/playground',
      name: 'playground',
      component: () => import('@/design-lab/DesignLabView.vue'),
    },
  ],
})

export default router

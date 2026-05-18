import { createRouter, createWebHistory } from 'vue-router'
import TransportView from '@/views/TransportView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'transport',
      component: TransportView
    }
  ]
})

export default router

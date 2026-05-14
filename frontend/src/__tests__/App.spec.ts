import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mount } from '@vue/test-utils'
import App from '../App.vue'

vi.mock('../composables/useTheme', () => ({
  useTheme: () => ({ theme: ref('light'), toggle: vi.fn() }),
}))

describe('App', () => {
  it('renders the routed content', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          component: {
            template: '<div>You did it!</div>',
          },
        },
      ],
    })

    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    })

    expect(wrapper.text()).toContain('You did it!')
  })
})

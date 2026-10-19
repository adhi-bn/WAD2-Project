import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Brand styling comes from Bootstrap CSS + the custom class namespace.
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
  },
})

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
  },
})

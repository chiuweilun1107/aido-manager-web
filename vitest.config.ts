import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    // 對齊 tsconfig 的 "@/*" path alias，讓測試能 import lib/* 內部用 @/ 互相引用的模組（如 self-service / bpm）
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})

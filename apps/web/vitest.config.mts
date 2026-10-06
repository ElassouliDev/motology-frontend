import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // tsconfig keeps JSX as-is for Next; tests need it compiled.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      // Key is '@', not '@/': Vite 8 stops resolving '@/x' imports with a trailing-slash key.
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // `server-only` throws outside the React Server Components bundler; tests run in plain Node.
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    restoreMocks: true,
  },
})

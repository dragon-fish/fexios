import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const PROD = process.env.NODE_ENV === 'production'

export default defineConfig({
  build: {
    lib: {
      name: 'Fexios',
      fileName: 'index',
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['umd', 'es', 'iife', 'cjs'],
    },
    sourcemap: true,
  },
  test: {
    coverage: {
      enabled: true,
      include: ['src/**'],
      reportsDirectory: './.test_reports/coverage',
    },
    reporters: ['default', 'html'],
    outputFile: {
      html: './.test_reports/index.html',
    },
  },
  esbuild: {
    drop: PROD ? ['console'] : undefined,
  },
  plugins: [dts()],
})

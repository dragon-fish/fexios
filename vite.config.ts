import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const PROD = process.env.NODE_ENV === 'production'

export default defineConfig({
  build: {
    lib: {
      name: 'Fexios',
      fileName: 'index',
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['umd', 'es', 'iife'],
    },
    sourcemap: true,
  },
  test: {
    coverage: {
      enabled: true,
      include: ['src/**'],
      reportsDirectory: './.test_reports/coverage',
    },
    reporters: [
      'default',
      ...(process.env.GITHUB_ACTIONS ? ['github-actions'] : ['html']),
    ],
    outputFile: {
      html: './.test_reports/index.html',
    },
  },
  esbuild: {
    drop: PROD ? ['console'] : undefined,
  },
  define: {
    // @FIX Uncaught ReferenceError: process is not defined
    // @link https://github.com/vitejs/vite/issues/9186
    'process.env.NODE_ENV': '"production"',
  },
  plugins: [dts()],
})

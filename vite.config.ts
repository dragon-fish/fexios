import { defineConfig, UserConfig } from 'vite'
import { version } from './package.json'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    target: 'es2020',
    outDir: 'lib',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: 'src/index.ts',
      name: 'Fexios',
      formats: ['umd'],
      fileName: () => 'index.js',
      cssFileName: 'style',
    },
  },
  plugins: [],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  define: {
    'import.meta.env.__VERSION__': JSON.stringify(version),
  },
  optimizeDeps: {},
  mode: process.env.NODE_ENV,
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
    testTimeout: 10 * 1000,
  },
} as UserConfig)

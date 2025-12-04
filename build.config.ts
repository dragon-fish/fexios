import { defineBuildConfig } from 'unbuild'
import { resolve } from 'node:path'
import { version } from './package.json'

export default defineBuildConfig({
  // entries: [], // auto detected by package.json
  replace: {
    'import.meta.env.__VERSION__': JSON.stringify(version),
  },
  alias: {
    '@': resolve(import.meta.dirname, 'src'),
  },
  clean: true,
  declaration: 'node16',
  sourcemap: true,
})

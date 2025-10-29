/**
 * Fexios
 * @desc Fetch based HTTP client with similar API to axios for browser and Node.js
 *
 * @license MIT
 * @author dragon-fish <dragon-fish@qq.com>
 */

// Export all types
export * from './types.js'

// Export errors
export * from './models/errors.js'

// Export response utilities
export * from './models/response.js'

// Export query builder
export * from './models/query-builder.js'

// Export utilities
export * from './utils.js'

// Export main Fexios class
export * from './fexios.js'

// Support for direct import
import { Fexios } from './fexios.js'
export const createFexios = Fexios.create
export const fexios = createFexios()
export default fexios

// Set global fexios instance for browser
declare global {
  interface Window {
    fexios: Fexios
  }
}
/* v8 ignore else -- @preserve */
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).fexios = fexios
} else if (typeof window !== 'undefined') {
  window.fexios = fexios
}

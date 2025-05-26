/**
 * Fexios
 * @desc Fetch based HTTP client with similar API to axios for browser and Node.js
 *
 * @license MIT
 * @author dragon-fish <dragon-fish@qq.com>
 */

// Export all types
export * from './types'

// Export errors
export * from './errors'

// Export response utilities
export * from './response'

// Export query builder
export * from './query-builder'

// Export utilities
export * from './utils'

// Export main Fexios class
export * from './fexios'

// Support for direct import
import { Fexios } from './fexios'
export const createFexios = Fexios.create
export const fexios = createFexios()
export default fexios

// Set global fexios instance for browser
declare global {
  interface Window {
    fexios: Fexios
  }
}
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).fexios = fexios
} else if (typeof window !== 'undefined') {
  window.fexios = fexios
}

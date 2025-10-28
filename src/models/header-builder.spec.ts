// FexiosHeaderBuilder.spec.ts
import { describe, it, expect } from 'vitest'
import { FexiosHeaderBuilder } from './header-builder.js'

const { makeHeaders, toHeaderRecord, mergeHeaders } = FexiosHeaderBuilder

describe('FexiosHeaderBuilder', () => {
  describe('makeHeaders', () => {
    it('builds from plain object: string / array / object / ignore null-undefined', () => {
      const h = makeHeaders({
        'x-a': '1',
        'x-b': ['2', '3'],
        'x-c': { k: 1 }, // -> "[object Object]"
        'x-d': null,
        'x-e': undefined,
      })
      expect(h.get('x-a')).toBe('1')
      // multiple values may be joined by the runtime (usually "2, 3")
      expect(h.get('x-b')).toContain('2')
      expect(h.get('x-b')).toContain('3')
      expect(h.get('x-c')).toBe('[object Object]')
      expect(h.has('x-d')).toBe(false)
      expect(h.has('x-e')).toBe(false)
    })

    it('clones when given Headers and does not mutate the copy after source changes', () => {
      const src = new Headers({ 'x-a': '1' })
      const h = makeHeaders(src)
      src.set('x-a', '9') // mutate source afterwards
      expect(h.get('x-a')).toBe('1') // cloned, unaffected
    })

    it('throws on non-plain input', () => {
      expect(() => makeHeaders(new Date() as any)).toThrow(TypeError)
    })
  })

  describe('toHeaderRecord', () => {
    it('returns Record<string, string[]> and keeps platform joining', () => {
      const h = new Headers()
      h.append('x-list', 'a')
      h.append('x-list', 'b')
      const rec = toHeaderRecord(h)
      expect(rec['x-list']).toBeDefined()
      expect(Array.isArray(rec['x-list'])).toBe(true)
      expect(rec['x-list']!.length).toBe(1)
      expect(rec['x-list']![0]).toContain('a')
      expect(rec['x-list']![0]).toContain('b')
    })
  })

  describe('mergeHeaders', () => {
    it('merges: overwrite, append array (reset before), ignore undefined', () => {
      const base = new Headers({ 'x-a': '1', 'x-b': '2' })
      const merged = mergeHeaders(base, {
        'x-b': '3', // overwrite
        'x-c': ['v1', 'v2'], // reset then append
        'x-d': undefined, // no change
      })
      expect(merged.get('x-a')).toBe('1')
      expect(merged.get('x-b')).toBe('3')
      expect(merged.get('x-c')).toContain('v1')
      expect(merged.get('x-c')).toContain('v2')
      expect(merged.has('x-d')).toBe(false)
      // base should be unchanged
      expect(base.get('x-b')).toBe('2')
      expect(base.has('x-c')).toBe(false)
    })

    it('supports deletion via null', () => {
      const base = new Headers({ 'x-a': '1', 'x-b': '2' })
      const merged = mergeHeaders(base, { 'x-a': null })
      expect(merged.has('x-a')).toBe(false)
      expect(merged.get('x-b')).toBe('2')
    })

    it('accepts Headers as income (set semantics)', () => {
      const base = new Headers({ 'x-a': '1', 'x-b': '2' })
      const income = new Headers({ 'x-b': '9', 'x-e': '5' })
      const merged = mergeHeaders(base, income)
      expect(merged.get('x-b')).toBe('9') // replaced by income headers
      expect(merged.get('x-e')).toBe('5')
    })

    it('array patch resets previous values before append', () => {
      const base = new Headers()
      base.append('x-k', 'old1')
      base.append('x-k', 'old2')
      const merged = mergeHeaders(base, { 'x-k': ['n1', 'n2'] })
      const val = merged.get('x-k')!
      expect(val).toContain('n1')
      expect(val).toContain('n2')
      expect(val).not.toContain('old1')
      expect(val).not.toContain('old2')
    })

    it('case-insensitive keys: later patch overwrites regardless of case', () => {
      const base = new Headers({ 'X-Case': 'A' })
      const merged = mergeHeaders(base, { 'x-case': 'B' })
      expect(merged.get('x-case')).toBe('B')
      expect(merged.has('X-Case')).toBe(true)
    })

    it('ignores null/undefined incomes safely', () => {
      const base = new Headers({ 'x-a': '1' })
      const merged = mergeHeaders(base, null, undefined, { 'x-b': '2' })
      expect(merged.get('x-a')).toBe('1')
      expect(merged.get('x-b')).toBe('2')
    })

    it('throws on non-plain object incomes', () => {
      const base = new Headers()
      expect(() => mergeHeaders(base, new Date() as any)).toThrow(TypeError)
    })
  })
})

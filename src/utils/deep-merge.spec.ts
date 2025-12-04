import { deepMerge } from './deep-merge.js'
import { describe, expect, it } from 'vitest'

describe('deepMerge', () => {
  it('should merge simple objects', () => {
    const obj = { a: 1, b: 2 }
    const result = deepMerge(obj, { b: 3, c: 4 } as any)
    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  it('should deep merge nested objects', () => {
    const obj = { a: 1, b: { c: 2, d: 3 } }
    const result = deepMerge(obj, { b: { c: 4 } } as any)
    expect(result).toEqual({ a: 1, b: { c: 4, d: 3 } })
  })

  it('should handle arrays by replacing them', () => {
    const obj = { items: [1, 2, 3] }
    const result = deepMerge(obj, { items: [4, 5] } as any)
    expect(result).toEqual({ items: [4, 5] })
  })

  it('should handle null and undefined inputs', () => {
    const obj = { a: 1, b: 2 }
    const result = deepMerge(obj, null, undefined, { b: 3 } as any)
    expect(result).toEqual({ a: 1, b: 3 })
  })

  it('should handle undefined values in input', () => {
    const obj = { a: 1, b: 2 }
    const result = deepMerge(obj, { a: undefined, b: 3 } as any)
    expect(result).toEqual({ a: 1, b: 3 })
  })

  it('should merge multiple objects in order', () => {
    const obj = { a: 1, b: 2, c: 3 }
    const result = deepMerge(obj, { b: 10 } as any, { c: 20 } as any)
    expect(result).toEqual({ a: 1, b: 10, c: 20 })
  })

  it('should deep merge multiple levels', () => {
    const obj = {
      level1: {
        level2: {
          level3: { value: 'original' },
        },
      },
    }
    const result = deepMerge(obj, {
      level1: {
        level2: {
          level3: { value: 'updated' },
        },
      },
    } as any)
    expect(result).toEqual({
      level1: {
        level2: {
          level3: { value: 'updated' },
        },
      },
    })
  })

  it('should not mutate original object', () => {
    const obj = { a: 1, b: { c: 2 } }
    const originalB = obj.b
    const result = deepMerge(obj, { b: { d: 3 } } as any)

    expect(obj.b).toBe(originalB)
    expect(result).toEqual({ a: 1, b: { c: 2, d: 3 } })
    expect(result.b).not.toBe(originalB)
  })

  it('should handle mixed primitive and object values', () => {
    const obj = { name: 'John', info: { age: 30 } }
    const result = deepMerge(obj, { name: 'Jane', info: { age: 25 } } as any)
    expect(result).toEqual({ name: 'Jane', info: { age: 25 } })
  })

  it('should handle Symbol keys', () => {
    const sym = Symbol('test')
    const obj: any = { a: 1, [sym]: 'value1' }
    const result = deepMerge(obj, { [sym]: 'value2' } as any)
    expect(result[sym]).toBe('value2')
    expect(result.a).toBe(1)
  })

  it('should handle replacing objects with primitives', () => {
    const obj = { data: { value: 1 } }
    const result = deepMerge(obj, { data: 'string' } as any)
    expect(result).toEqual({ data: 'string' })
  })

  it('should handle empty objects', () => {
    const obj = { a: 1 }
    const result = deepMerge(obj, {} as any)
    expect(result).toEqual({ a: 1 })
  })

  it('should handle empty input object', () => {
    const obj = {}
    const result = deepMerge(obj, { a: 1 } as any)
    expect(result).toEqual({ a: 1 })
  })
})

import { describe, expect, it } from 'vitest'
import { FexiosQueryBuilder } from './index.js'

/**
 * Tests for FexiosQueryBuilder utility functions
 * These are pure unit tests for query string building functionality
 */

describe('QueryBuilder', () => {
  describe('makeQueryString', () => {
    it('should build basic query string', () => {
      const query = { a: '1', b: '2', c: 'test' }
      const result = FexiosQueryBuilder.makeQueryString(query)
      expect(result).toBe('a=1&b=2&c=test')
    })

    it('should handle array values by creating multiple entries', () => {
      const query = { foo: ['bar', 'baz'], single: 'value' }
      const queryString = FexiosQueryBuilder.makeQueryString(query)
      expect(queryString).toContain('foo=bar')
      expect(queryString).toContain('foo=baz')
      expect(queryString).toContain('single=value')
    })

    it('should handle array values with [] suffix', () => {
      const query = { 'arr[]': ['bar', 'baz'], single: 'value' }
      const queryString = FexiosQueryBuilder.makeQueryString(query)
      expect(queryString).toContain('arr%5B%5D=bar')
      expect(queryString).toContain('arr%5B%5D=baz')
      expect(queryString).toContain('single=value')
    })

    it('should handle empty arrays', () => {
      const query = { empty: [], single: 'value' }
      const queryString = FexiosQueryBuilder.makeQueryString(query)
      expect(queryString).toBe('single=value')
    })

    it('should handle empty object', () => {
      const query = {}
      const result = FexiosQueryBuilder.makeQueryString(query)
      expect(result).toBe('')
    })
  })

  describe('makeSearchParams', () => {
    it('should handle array values by creating multiple entries', () => {
      const query = { foo: ['bar', 'baz'], single: 'value' }
      const searchParams = FexiosQueryBuilder.makeSearchParams(query)

      expect(searchParams.getAll('foo')).toEqual(['bar', 'baz'])
      expect(searchParams.get('single')).toBe('value')
    })

    it('should handle array values with [] suffix', () => {
      const query = { 'arr[]': ['bar', 'baz'], single: 'value' }
      const searchParams = FexiosQueryBuilder.makeSearchParams(query)

      expect(searchParams.getAll('arr[]')).toEqual(['bar', 'baz'])
      expect(searchParams.get('single')).toBe('value')
    })

    it('should handle mixed types by converting to strings', () => {
      const query = {
        str: 'test',
        num: 123,
        bool: true,
        arr: [1, 2, 'three'],
      }
      const searchParams = FexiosQueryBuilder.makeSearchParams(query)

      expect(searchParams.get('str')).toBe('test')
      expect(searchParams.get('num')).toBe('123')
      expect(searchParams.get('bool')).toBe('true')
      expect(searchParams.getAll('arr')).toEqual(['1', '2', 'three'])
    })

    it('should handle empty arrays', () => {
      const query = { empty: [], single: 'value' }
      const searchParams = FexiosQueryBuilder.makeSearchParams(query)

      expect(searchParams.getAll('empty')).toEqual([])
      expect(searchParams.get('single')).toBe('value')
    })

    it('should handle nested objects with array keys', () => {
      const sp = FexiosQueryBuilder.makeSearchParams({
        obj: { 'tags[]': ['a', 'b'] },
      })
      expect(sp.toString()).toBe(encodeURI('obj[tags][]=a&obj[tags][]=b'))
    })

    it('should handle deeply nested objects', () => {
      const sp = FexiosQueryBuilder.makeSearchParams({
        deepObj: { a: { b: { c: 3 } } },
      })
      expect(sp.toString()).toBe(encodeURI('deepObj[a][b][c]=3'))
    })
  })

  describe('toQueryRecord', () => {
    it('should convert basic key-value pairs to record', () => {
      const sp = new URLSearchParams('foo=bar&baz=qux&number=123&bool=true')
      const obj = FexiosQueryBuilder.toQueryRecord(sp)

      expect(obj).toEqual({
        foo: 'bar',
        baz: 'qux',
        number: '123',
        bool: 'true',
      })
    })

    it('should convert repeated keys to arrays', () => {
      const sp = new URLSearchParams('foo=bar&foo=baz&single=value')
      const obj = FexiosQueryBuilder.toQueryRecord(sp)

      expect(obj).toEqual({
        foo: ['bar', 'baz'],
        single: 'value',
      })
    })

    it('should reconstruct nested objects', () => {
      const sp = new URLSearchParams(
        'obj[foo]=bar&obj[baz]=qux&deep[dark][fantasy]=yes'
      )
      const obj = FexiosQueryBuilder.toQueryRecord(sp)

      expect(obj).toEqual({
        obj: { foo: 'bar', baz: 'qux' },
        deep: { dark: { fantasy: 'yes' } },
      })
    })

    it('should treat [] suffix as arrays (single and multiple)', () => {
      const sp1 = new URLSearchParams('arr[]=only-one-value')
      const sp2 = new URLSearchParams('arr[]=1&arr[]=2')

      expect(FexiosQueryBuilder.toQueryRecord(sp1)).toEqual({
        'arr[]': ['only-one-value'],
      })
      expect(FexiosQueryBuilder.toQueryRecord(sp2)).toEqual({
        'arr[]': ['1', '2'],
      })
    })

    it('should support nested array semantics with []', () => {
      const sp = new URLSearchParams('obj[tags][]=a&obj[tags][]=b')
      const obj = FexiosQueryBuilder.toQueryRecord(sp)

      expect(obj).toEqual({ obj: { 'tags[]': ['a', 'b'] } })
    })

    it('should handle repeated nested keys as arrays', () => {
      const sp = new URLSearchParams('obj[a]=1&obj[a]=2')
      const obj = FexiosQueryBuilder.toQueryRecord(sp)

      expect(obj).toEqual({ obj: { a: ['1', '2'] } })
    })

    it('should handle deeply nested objects', () => {
      const sp = new URLSearchParams('deepObj[a][b][c]=3')
      const obj = FexiosQueryBuilder.toQueryRecord(sp)

      expect(obj).toEqual({ deepObj: { a: { b: { c: '3' } } } })
    })

    it('should return empty object for empty params', () => {
      const sp = new URLSearchParams('')
      const obj = FexiosQueryBuilder.toQueryRecord(sp)
      expect(obj).toEqual({})
    })
  })
})

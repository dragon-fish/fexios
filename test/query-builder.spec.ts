import { describe, expect, it } from 'vitest'
import { FexiosQueryBuilder } from '../src/index'

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
        arr: [1, 2, 'three']
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
  })
})

import { describe, expect, it } from 'vitest'
import { FexiosQueryBuilder } from '../index.js'

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

  describe('mergeQueries', () => {
    it('merges flat objects', () => {
      const res = FexiosQueryBuilder.mergeQueries(
        {},
        { a: '1' },
        { b: '2' },
        { c: '3' }
      )
      expect(res).toEqual({ a: '1', b: '2', c: '3' })
    })

    it('later incomes overwrite earlier keys', () => {
      const res = FexiosQueryBuilder.mergeQueries(
        { a: '1', b: '2' },
        { b: '3', c: '4' }
      )
      expect(res).toEqual({ a: '1', b: '3', c: '4' })
    })

    it('ignores undefined and removes key on null', () => {
      const res = FexiosQueryBuilder.mergeQueries(
        { a: '1', b: '2', keep: 'y' },
        { a: undefined, b: null, keep: undefined, add: undefined as any }
      )
      expect(res).toEqual({ a: '1', keep: 'y' })
    })

    it('deep merges plain objects and supports deep null deletions', () => {
      const res = FexiosQueryBuilder.mergeQueries(
        { a: { x: 1, y: 2 }, b: { c: 1 } },
        { a: { y: 99 }, b: { c: null }, d: { k: 'v' } }
      )
      expect(res).toEqual({ a: { x: 1, y: 99 }, b: {}, d: { k: 'v' } })
    })

    it('arrays overwrite rather than concat', () => {
      const res = FexiosQueryBuilder.mergeQueries(
        { arr: [1, 2], nest: { tags: ['a'] } },
        { arr: [3], nest: { tags: ['b', 'c'] } }
      )
      expect(res).toEqual({ arr: [3], nest: { tags: ['b', 'c'] } })
    })

    it('handles URLSearchParams as original', () => {
      const orig = new URLSearchParams('a=1&b=2')
      const res = FexiosQueryBuilder.mergeQueries(orig, { b: '3', c: '4' })
      expect(res).toEqual({ a: '1', b: '3', c: '4' })
    })

    it('handles URLSearchParams in incomes', () => {
      const res = FexiosQueryBuilder.mergeQueries(
        { a: '1' },
        new URLSearchParams('b=2&c=3')
      )
      expect(res).toEqual({ a: '1', b: '2', c: '3' })
    })

    it('supports bracket array keys [] semantics from URLSearchParams', () => {
      const res = FexiosQueryBuilder.mergeQueries(
        {},
        new URLSearchParams('arr[]=only-one-value')
      )
      // toQueryRecord 的语义：带 [] 的 key 固定为数组
      expect(res).toEqual({ 'arr[]': ['only-one-value'] })
    })

    it('reconstructs nested objects from bracket notation in URLSearchParams', () => {
      const res = FexiosQueryBuilder.mergeQueries(
        {},
        new URLSearchParams('obj[foo]=bar&obj[baz]=qux&deep[dark][fantasy]=yes')
      )
      expect(res).toEqual({
        obj: { foo: 'bar', baz: 'qux' },
        deep: { dark: { fantasy: 'yes' } },
      })
    })

    it('does not mutate original object', () => {
      const original = { a: { x: 1 }, arr: [1, 2] as any }
      const snapshot = JSON.parse(JSON.stringify(original))
      const res = FexiosQueryBuilder.mergeQueries(
        original,
        { a: { y: 2 } },
        { arr: [3] }
      )
      expect(res).toEqual({ a: { x: 1, y: 2 }, arr: [3] })
      expect(original).toEqual(snapshot) // 原对象未被修改
    })

    it('overwrites non-plain values (Date, RegExp, custom instances)', () => {
      class Box {
        constructor(public v: number) {}
      }
      const res = FexiosQueryBuilder.mergeQueries(
        { d: new Date('2020-01-01T00:00:00Z'), r: /a/, box: new Box(1) },
        { d: new Date('2021-01-01T00:00:00Z'), r: /b/, box: new Box(2) }
      )
      expect(res.d).toEqual(new Date('2021-01-01T00:00:00Z'))
      expect(String(res.r)).toBe(String(/b/))
      expect(res.box).toBeInstanceOf(Box)
      expect((res.box as any).v).toBe(2)
    })

    it('ignores null/undefined incomes safely', () => {
      const res = FexiosQueryBuilder.mergeQueries(
        { a: '1' },
        null as any,
        undefined as any,
        {
          b: 2,
        }
      )
      expect(res).toEqual({ a: '1', b: 2 })
    })

    it('supports removing nested keys without dropping siblings', () => {
      const res = FexiosQueryBuilder.mergeQueries(
        { a: { b: 1, c: 2 } },
        { a: { b: null } }
      )
      expect(res).toEqual({ a: { c: 2 } })
    })

    describe('wierd cases (but should works)', () => {
      it('handles FormData as original parameter', () => {
        const formData = new FormData()
        formData.append('name', 'John')
        formData.append('age', '25')
        formData.append('hobbies', 'reading')
        formData.append('hobbies', 'coding')

        const res = FexiosQueryBuilder.mergeQueries(formData, {
          city: 'Beijing',
        })
        expect(res).toEqual({
          name: 'John',
          age: '25',
          hobbies: ['reading', 'coding'],
          city: 'Beijing',
        })
      })

      it('handles FormData in incomes', () => {
        const formData = new FormData()
        formData.append('email', 'test@example.com')
        formData.append('role', 'admin')

        const res = FexiosQueryBuilder.mergeQueries({ id: '123' }, formData)
        expect(res).toEqual({
          id: '123',
          email: 'test@example.com',
          role: 'admin',
        })
      })

      it('merges multiple FormData objects', () => {
        const formData1 = new FormData()
        formData1.append('a', '1')
        formData1.append('b', '2')

        const formData2 = new FormData()
        formData2.append('b', '3')
        formData2.append('c', '4')

        const res = FexiosQueryBuilder.mergeQueries(formData1, formData2)
        expect(res).toEqual({
          a: '1',
          b: '3', // 后面的覆盖前面的
          c: '4',
        })
      })

      it('mixes FormData with URLSearchParams and plain objects', () => {
        const formData = new FormData()
        formData.append('form', 'data')

        const urlParams = new URLSearchParams('url=params')

        const res = FexiosQueryBuilder.mergeQueries(formData, urlParams, {
          extra: 'value',
        })
        expect(res).toEqual({
          form: 'data',
          url: 'params',
          extra: 'value',
        })
      })

      it('handles FormData with repeated keys as arrays', () => {
        const formData = new FormData()
        formData.append('tags', 'javascript')
        formData.append('tags', 'typescript')
        formData.append('tags', 'nodejs')

        const res = FexiosQueryBuilder.mergeQueries({}, formData)
        expect(res).toEqual({
          tags: ['javascript', 'typescript', 'nodejs'],
        })
      })
    })
  })
})

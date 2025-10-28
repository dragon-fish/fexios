import { beforeEach, describe, expect, it } from 'vitest'
import fexios, { Fexios } from '../src/index'
import { mockFetch } from './mockFetch.js'

Fexios.DEFAULT_CONFIGS.fetch = mockFetch
fexios.baseConfigs.fetch = mockFetch

describe('Merge Utilities', () => {
  let fexios: Fexios

  beforeEach(() => {
    fexios = new Fexios()
  })

  describe('mergeQuery', () => {
    it('should merge basic query parameters', () => {
      const result = fexios.mergeQuery({ a: '1', b: '2' }, { c: '3', d: '4' })
      expect(result).toEqual({ a: '1', b: '2', c: '3', d: '4' })
    })

    it('should handle undefined values by dropping them', () => {
      const result = fexios.mergeQuery(
        { a: '1', b: '2' },
        { c: '3', d: undefined, e: '5' }
      )
      expect(result).toEqual({ a: '1', b: '2', c: '3', e: '5' })
    })

    it('should handle null values by dropping them', () => {
      const result = fexios.mergeQuery(
        { a: '1', b: '2' },
        { c: '3', d: null, e: '5' }
      )
      expect(result).toEqual({ a: '1', b: '2', c: '3', e: '5' })
    })

    it('should handle empty string values (keep them)', () => {
      const result = fexios.mergeQuery(
        { a: '1', b: '2' },
        { c: '3', d: '', e: '5' }
      )
      expect(result).toEqual({ a: '1', b: '2', c: '3', d: '', e: '5' })
    })

    it('should handle zero values (keep them)', () => {
      const result = fexios.mergeQuery(
        { a: '1', b: '2' },
        { c: '3', d: 0, e: '5' }
      )
      expect(result).toEqual({ a: '1', b: '2', c: '3', d: '0', e: '5' })
    })

    it('should handle false values (keep them)', () => {
      const result = fexios.mergeQuery(
        { a: '1', b: '2' },
        { c: '3', d: false, e: '5' }
      )
      expect(result).toEqual({ a: '1', b: '2', c: '3', d: 'false', e: '5' })
    })

    it('should override previous values', () => {
      const result = fexios.mergeQuery({ a: '1', b: '2' }, { a: '10', c: '3' })
      expect(result).toEqual({ a: '10', b: '2', c: '3' })
    })

    it('should handle URLSearchParams as input', () => {
      const searchParams = new URLSearchParams('a=1&b=2')
      const result = fexios.mergeQuery(searchParams, { c: '3', d: '4' })
      expect(result).toEqual({ a: '1', b: '2', c: '3', d: '4' })
    })

    it('should handle string as input', () => {
      const result = fexios.mergeQuery('a=1&b=2', { c: '3', d: '4' })
      expect(result).toEqual({ a: '1', b: '2', c: '3', d: '4' })
    })

    it('should handle undefined base', () => {
      const result = fexios.mergeQuery(undefined!, { a: '1', b: '2' })
      expect(result).toEqual({ a: '1', b: '2' })
    })

    it('should handle undefined income parameters', () => {
      const result = fexios.mergeQuery({ a: '1', b: '2' }, undefined, null, {
        c: '3',
      })
      expect(result).toEqual({ a: '1', b: '2', c: '3' })
    })

    it('should handle empty object input', () => {
      const result = fexios.mergeQuery({ a: '1', b: '2' }, {}, { c: '3' })
      expect(result).toEqual({ a: '1', b: '2', c: '3' })
    })

    it('should handle object with all undefined values', () => {
      const result = fexios.mergeQuery(
        { a: '1', b: '2' },
        { c: undefined, d: undefined },
        { e: '3' }
      )
      expect(result).toEqual({ a: '1', b: '2', e: '3' })
    })

    it('should handle complex object with mixed types', () => {
      const result = fexios.mergeQuery(
        { a: '1' },
        {
          b: 'test',
          c: 123,
          d: true,
          e: undefined,
          f: null,
          g: '',
          h: 0,
          i: false,
        }
      )
      expect(result).toEqual({
        a: '1',
        b: 'test',
        c: '123',
        d: 'true',
        g: '',
        h: '0',
        i: 'false',
      })
    })

    it('should handle Headers object as input', () => {
      const headers = new Headers({ 'x-custom': 'value' })
      const result = fexios.mergeQuery(headers, { a: '1', b: '2' })
      expect(result).toEqual({ 'x-custom': 'value', a: '1', b: '2' })
    })

    it('should handle array values by creating multiple query parameters', () => {
      const result = fexios.mergeQuery({ a: '1' }, { b: [1, 2, 3], c: 'test' })
      expect(result).toEqual({ a: '1', b: ['1', '2', '3'], c: 'test' })
    })

    it('should handle array values with [] suffix by creating multiple query parameters', () => {
      const result = fexios.mergeQuery(
        { a: '1' },
        { 'b[]': [1, 2, 3], c: 'test' }
      )
      expect(result).toEqual({ a: '1', 'b[]': ['1', '2', '3'], c: 'test' })
    })
  })

  describe('mergeHeaders', () => {
    it('should merge basic headers', () => {
      const result = fexios.mergeHeaders(
        { 'Content-Type': 'application/json' },
        { Authorization: 'Bearer token' }
      )
      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      })
    })

    it('should handle undefined values by dropping them', () => {
      const result = fexios.mergeHeaders(
        { 'Content-Type': 'application/json' },
        { Authorization: 'Bearer token', 'X-Custom': undefined }
      )
      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      })
    })

    it('should handle null values by dropping them', () => {
      const result = fexios.mergeHeaders(
        { 'Content-Type': 'application/json' },
        { Authorization: 'Bearer token', 'X-Custom': null }
      )
      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      })
    })

    it('should handle empty string values (keep them)', () => {
      const result = fexios.mergeHeaders(
        { 'Content-Type': 'application/json' },
        { Authorization: 'Bearer token', 'X-Custom': '' }
      )
      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
        'x-custom': '',
      })
    })

    it('should override previous headers (case insensitive)', () => {
      const result = fexios.mergeHeaders(
        { 'Content-Type': 'application/json' },
        { 'content-type': 'text/plain' }
      )
      expect(result).toEqual({ 'content-type': 'text/plain' })
    })

    it('should handle Headers object as input', () => {
      const headers = new Headers({ 'Content-Type': 'application/json' })
      const result = fexios.mergeHeaders(headers, {
        Authorization: 'Bearer token',
      })
      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      })
    })

    it('should handle undefined base', () => {
      const result = fexios.mergeHeaders(undefined!, {
        'Content-Type': 'application/json',
      })
      expect(result).toEqual({ 'content-type': 'application/json' })
    })

    it('should handle undefined income parameters', () => {
      const result = fexios.mergeHeaders(
        { 'Content-Type': 'application/json' },
        undefined,
        null,
        { Authorization: 'Bearer token' }
      )
      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      })
    })

    it('should handle empty object input', () => {
      const result = fexios.mergeHeaders(
        { 'Content-Type': 'application/json' },
        {},
        { Authorization: 'Bearer token' }
      )
      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      })
    })

    it('should handle object with all undefined values', () => {
      const result = fexios.mergeHeaders(
        { 'Content-Type': 'application/json' },
        { 'X-Custom': undefined, 'X-Another': undefined },
        { Authorization: 'Bearer token' }
      )
      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      })
    })

    it('should handle mixed Headers and plain objects', () => {
      const headers = new Headers({ 'Content-Type': 'application/json' })
      const result = fexios.mergeHeaders(
        headers,
        { Authorization: 'Bearer token', 'X-Custom': undefined },
        new Headers({ 'X-Version': '1.0' })
      )
      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
        'x-version': '1.0',
      })
    })

    it('should handle case sensitivity properly', () => {
      const result = fexios.mergeHeaders(
        { 'Content-Type': 'application/json' },
        { AUTHORIZATION: 'Bearer token' },
        { 'x-custom-header': 'value' }
      )
      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
        'x-custom-header': 'value',
      })
    })
  })
})

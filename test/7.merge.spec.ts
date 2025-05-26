import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { Fexios } from '../src/index'

/**
 * What is the priority of query/headers merging in Fexios?
 * requestOptions > requestURL > defaultOptions > baseURL
 * 
 * @example
 * ```js
const fexios = new Fexios({
  baseURL: 'https://example.com/?from=baseURL',
  query: {
    from: 'defaultOptions',
  },
})
fexios.get('/path?from=requestURL', {
  query: {
    from: 'requestOptions',
  },
})
// The final URL will be: https://example.com/path?from=requestOptions
```
 */

describe('Merge Methods - Query and Headers', () => {
  const fexios = new Fexios()

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
      const result = fexios.mergeQuery(undefined, { a: '1', b: '2' })
      expect(result).toEqual({ a: '1', b: '2' })
    })

    it('should handle undefined income parameters', () => {
      const result = fexios.mergeQuery(
        { a: '1', b: '2' },
        undefined,
        // @ts-expect-error
        null,
        { c: '3' }
      )
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

    it('should handle array values by converting to string', () => {
      const result = fexios.mergeQuery({ a: '1' }, { b: [1, 2, 3], c: 'test' })
      expect(result).toEqual({ a: '1', b: '1,2,3', c: 'test' })
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
      const result = fexios.mergeHeaders(undefined, {
        'Content-Type': 'application/json',
      })
      expect(result).toEqual({ 'content-type': 'application/json' })
    })

    it('should handle undefined income parameters', () => {
      const result = fexios.mergeHeaders(
        { 'Content-Type': 'application/json' },
        undefined,
        // @ts-expect-error
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

  describe('Integration tests with undefined handling', () => {
    let mockFetch: any

    beforeAll(() => {
      mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      global.fetch = mockFetch
    })

    beforeEach(() => {
      mockFetch.mockClear()
    })

    afterAll(() => {
      vi.restoreAllMocks()
    })

    it('should work with axios-like API where undefined values are ignored', async () => {
      // This simulates the usage pattern mentioned in the request

      const testFexios = new Fexios({ baseURL: 'https://api.example.com' })

      await testFexios.get('/foo?bar=1', {
        query: {
          bar: undefined, // This should be ignored
          baz: 'test', // This should be kept
          qux: null, // This should be ignored
        },
        headers: {
          Authorization: 'Bearer token',
          // @ts-expect-error
          'X-Custom': undefined, // This should be ignored
          // @ts-expect-error
          'Content-Type': null, // This should be ignored
        },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('baz=test'),
        })
      )

      // URL should not contain bar since it was undefined
      const calledUrl = mockFetch.mock.calls[0][0].url
      expect(calledUrl).not.toContain('bar=')
      expect(calledUrl).toContain('baz=test')

      // Headers should not contain undefined values
      const calledHeaders =
        mockFetch.mock.calls[0][1]?.headers ||
        mockFetch.mock.calls[0][0].headers
      const headersObject =
        calledHeaders instanceof Headers
          ? Object.fromEntries(calledHeaders.entries())
          : calledHeaders

      expect(headersObject).toHaveProperty('authorization', 'Bearer token')
      expect(headersObject).not.toHaveProperty('x-custom')
      expect(headersObject).not.toHaveProperty('content-type')
    })

    it('should preserve falsy values that are not undefined or null', async () => {
      const testFexios = new Fexios({ baseURL: 'https://api.example.com' })

      await testFexios.get('/test', {
        query: {
          empty: '',
          zero: 0,
          falsy: false,
          undef: undefined,
          nullVal: null,
        },
      })

      const calledUrl = mockFetch.mock.calls[0][0].url
      expect(calledUrl).toContain('empty=')
      expect(calledUrl).toContain('zero=0')
      expect(calledUrl).toContain('falsy=false')
      expect(calledUrl).not.toContain('undef=')
      expect(calledUrl).not.toContain('nullVal=')
    })
  })

  describe('Merge Priority Tests', () => {
    let mockFetch: any

    beforeAll(() => {
      mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      global.fetch = mockFetch
    })

    beforeEach(() => {
      mockFetch.mockClear()
    })

    afterAll(() => {
      vi.restoreAllMocks()
    })

    describe('Query Parameters Priority: requestOptions > requestURL > defaultOptions > baseURL', () => {    it('should respect the complete priority chain', async () => {

      // Create fexios with baseURL containing query params and default options
      const testFexios = new Fexios({
        baseURL: 'https://api.example.com/?source=baseURL&priority=1&keep=base',
        query: {
          source: 'defaultOptions',
          priority: 2,
          default: 'option',
        },
      })

      await testFexios.get('/path?source=requestURL&priority=3&url=param', {
        query: {
          source: 'requestOptions',
          priority: 4,
          request: 'option',
        },
      })

      const calledUrl = mockFetch.mock.calls[0][0].url
      const url = new URL(calledUrl)
      const params = Object.fromEntries(url.searchParams.entries())

      // Verify priority: requestOptions wins
      expect(params.source).toBe('requestOptions')
      expect(params.priority).toBe('4')
      
      // Verify each level contributes unique parameters
      expect(params.keep).toBe('base') // from baseURL
      expect(params.default).toBe('option') // from defaultOptions
      expect(params.url).toBe('param') // from requestURL
      expect(params.request).toBe('option') // from requestOptions
    })

      it('should handle empty levels gracefully', async () => {
        // Test with minimal configuration
        const testFexios = new Fexios({
          baseURL: 'https://api.example.com/', // No query in baseURL
          // No default query
        })

        await testFexios.get('/path', { // No query in URL
          query: {
            only: 'requestOptions',
          },
        })

        const calledUrl = mockFetch.mock.calls[0][0].url
        const url = new URL(calledUrl)
        const params = Object.fromEntries(url.searchParams.entries())

        expect(params.only).toBe('requestOptions')
        expect(Object.keys(params)).toHaveLength(1)
      })

      it('should override previous values correctly', async () => {
        const testFexios = new Fexios({
          baseURL: 'https://api.example.com/?shared=base',
          query: {
            shared: 'default',
          },
        })

        await testFexios.get('/path?shared=url', {
          query: {
            shared: 'request',
          },
        })

        const calledUrl = mockFetch.mock.calls[0][0].url
        const url = new URL(calledUrl)
        
        // Should only have the highest priority value
        expect(url.searchParams.get('shared')).toBe('request')
        expect(url.searchParams.getAll('shared')).toHaveLength(1)
      })
    })

    describe('Headers Priority: requestOptions > defaultOptions', () => {
      it('should merge headers with correct priority', async () => {
        const testFexios = new Fexios({
          baseURL: 'https://api.example.com',
          headers: {
            'Authorization': 'Bearer default-token',
            'X-Client': 'default-client',
            'Content-Type': 'application/json',
          },
        })

        await testFexios.post('/api', { data: 'test' }, {
          headers: {
            'Authorization': 'Bearer request-token', // Should override
            'X-Custom': 'request-header', // Should add
            // Content-Type should be kept from default
          },
        })

        const calledHeaders = mockFetch.mock.calls[0][1]?.headers || mockFetch.mock.calls[0][0].headers
        const headersObject = calledHeaders instanceof Headers
          ? Object.fromEntries(calledHeaders.entries())
          : calledHeaders

        // Verify priority: requestOptions overrides defaultOptions
        expect(headersObject.authorization).toBe('Bearer request-token')
        
        // Verify default headers are preserved when not overridden
        expect(headersObject['x-client']).toBe('default-client')
        
        // Verify new headers from request are added
        expect(headersObject['x-custom']).toBe('request-header')
        
        // Content-Type should be from JSON body processing, not from defaults
        expect(headersObject['content-type']).toContain('application/json')
      })

      it('should handle case-insensitive header overrides', async () => {
      const testFexios = new Fexios({
        baseURL: 'https://api.example.com',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'default-key',
        },
      })

      await testFexios.get('/api', {
        headers: {
          'content-type': 'text/plain', // Different case
          'X-Api-Key': 'request-key', // Different case
        },
      })

      const calledHeaders = mockFetch.mock.calls[0][1]?.headers || mockFetch.mock.calls[0][0].headers
      const headersObject = calledHeaders instanceof Headers
        ? Object.fromEntries(calledHeaders.entries())
        : calledHeaders

      // Headers should be case-insensitive, request options should win
      expect(headersObject['content-type']).toBe('text/plain')
      expect(headersObject['x-api-key']).toBe('request-key')
    })
    })

  describe('Priority with undefined/null handling', () => {
    it('should respect priority while filtering undefined/null values', async () => {
      const testFexios = new Fexios({
        baseURL: 'https://api.example.com',
        query: {
          keep: 'default',
          override: 'default',
          remove: 'default',
        },
      })

      await testFexios.get('/path?override=url', {
        query: {
          override: 'request',
          remove: undefined, // Should remove the 'default' value
          add: 'new',
        },
      })

      const calledUrl = mockFetch.mock.calls[0][0].url
      const url = new URL(calledUrl)
      const params = Object.fromEntries(url.searchParams.entries())

      expect(params.keep).toBe('default') // Not overridden
      expect(params.override).toBe('request') // Overridden by request
      expect(params.remove).toBeUndefined() // Removed by undefined
      expect(params.add).toBe('new') // Added by request
    })
  })

    describe('Documentation example verification', () => {
      it('should match the example in the file comments', async () => {
        const fexios = new Fexios({
          baseURL: 'https://example.com/?from=baseURL',
          query: {
            from: 'defaultOptions',
          },
        })
        
        await fexios.get('/path?from=requestURL', {
          query: {
            from: 'requestOptions',
          },
        })

        const calledUrl = mockFetch.mock.calls[0][0].url
        expect(calledUrl).toBe('https://example.com/path?from=requestOptions')
      })
    })
  })
})

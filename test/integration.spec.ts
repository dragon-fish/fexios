import { describe, expect, it, beforeAll } from 'vitest'
import { Fexios } from '../src/index'
import { MOCK_FETCH_BASE_URL, mockFetch } from './mockFetch'

/**
 * Integration tests that involve actual HTTP requests with mocked fetch
 * These tests verify that merge logic works correctly in real request scenarios
 */

describe('Integration Tests - HTTP Requests with Merge Logic', () => {
  let fexios: Fexios

  beforeAll(() => {
    fexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })
  })

  describe('Query parameters in HTTP requests', () => {
    it('should work with axios-like API where undefined values are ignored', async () => {
      // This simulates the usage pattern mentioned in the request
      const testFexios = new Fexios({
        baseURL: 'https://api.example.com',
        fetch: mockFetch,
        headers: { 'X-Removed': 'true' },
      })

      const res = await testFexios.get('/foo?bar=1&qux=2', {
        query: {
          bar: undefined, // This should be ignored
          baz: 'test', // This should be kept
          qux: null, // This should be removed
        },
        headers: {
          Authorization: 'Bearer token',
          'X-Custom': undefined, // This should be ignored
          'X-Removed': null, // This should be removed
        },
      })

      // URL should contain baz=test
      expect(res.data.url).toContain('baz=test')

      // URL should not contain bar since it was undefined
      const calledUrl = res.data.url
      expect(calledUrl).toContain('bar=1')
      expect(calledUrl).not.toContain('qux=')
      expect(calledUrl).toContain('baz=test')

      // Headers should not contain undefined values
      const headersObject = res.data.headers

      expect(headersObject).toHaveProperty('authorization', 'Bearer token')
      expect(headersObject).not.toHaveProperty('x-custom')
      expect(headersObject).not.toHaveProperty('content-type')
    })

    it('should preserve falsy values that are not undefined or null', async () => {
      const testFexios = new Fexios({
        baseURL: 'https://api.example.com',
        fetch: mockFetch,
      })

      const res = await testFexios.get('/test', {
        query: {
          empty: '',
          zero: 0,
          falsy: false,
          undef: undefined,
          nullVal: null,
        },
      })
      const calledUrl = res.data.url
      expect(calledUrl).toContain('empty=')
      expect(calledUrl).toContain('zero=0')
      expect(calledUrl).toContain('falsy=false')
      expect(calledUrl).not.toContain('undef=')
      expect(calledUrl).not.toContain('nullVal=')
    })

    it('should handle array query parameters in actual requests', async () => {
      const testFexios = new Fexios({
        baseURL: 'https://api.example.com',
        fetch: mockFetch,
      })

      const res = await testFexios.get('/test', {
        query: {
          foo: ['bar', 'baz'],
          single: 'value',
        },
      })
      const calledUrl = res.data.url
      const url = new URL(calledUrl)

      // Should have multiple foo parameters
      expect(url.searchParams.getAll('foo')).toEqual(['bar', 'baz'])
      expect(url.searchParams.get('single')).toBe('value')

      // Check the actual URL string format
      expect(calledUrl).toContain('foo=bar')
      expect(calledUrl).toContain('foo=baz')
      expect(calledUrl).toContain('single=value')
    })

    it('should handle array query parameters with [] suffix', async () => {
      const testFexios = new Fexios({
        baseURL: 'https://api.example.com',
        fetch: mockFetch,
      })

      const res = await testFexios.get('/test', {
        query: {
          'arr[]': ['bar', 'baz'],
          single: 'value',
        },
      })
      const calledUrl = res.data.url
      const url = new URL(calledUrl)

      // Should have multiple arr[] parameters
      expect(url.searchParams.getAll('arr[]')).toEqual(['bar', 'baz'])
      expect(url.searchParams.get('single')).toBe('value')

      // Check the actual URL string format (URL-encoded)
      expect(calledUrl).toContain('arr%5B%5D=bar')
      expect(calledUrl).toContain('arr%5B%5D=baz')
      expect(calledUrl).toContain('single=value')
    })
  })

  describe('Headers in HTTP requests', () => {
    it('should merge headers with correct priority', async () => {
      const testFexios = new Fexios({
        baseURL: 'https://api.example.com',
        fetch: mockFetch,
        headers: {
          Authorization: 'Bearer default-token',
          'X-Client': 'default-client',
          'Content-Type': 'application/json',
        },
      })

      const res = await testFexios.post(
        '/api',
        { data: 'test' },
        {
          headers: {
            Authorization: 'Bearer request-token', // Should override
            'X-Custom': 'request-header', // Should add
            // Content-Type should be kept from default
          },
        }
      )

      const headersObject = res.data.headers

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
        fetch: mockFetch,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'default-key',
        },
      })

      const res = await testFexios.get('/api', {
        headers: {
          'content-type': 'text/plain', // Different case
          'X-Api-Key': 'request-key', // Different case
        },
      })

      const headersObject = res.data.headers

      // Headers should be case-insensitive, request options should win
      expect(headersObject['content-type']).toBe('text/plain')
      expect(headersObject['x-api-key']).toBe('request-key')
    })
  })

  describe('Priority handling in HTTP requests', () => {
    it('should respect priority while filtering undefined/null values', async () => {
      const testFexios = new Fexios({
        baseURL:
          'https://api.example.com/?defaultinbase=default&overrideinbase=default&removeinbase=default',
        fetch: mockFetch,
        query: {
          keep: 'default',
          nochange: 'default',
          override: 'default',
          remove: 'default',
        },
      })

      const res = await testFexios.get(
        '/path?override=url&addedinurl=yes&overrideinbase=url&removeinurl=yes',
        {
          query: {
            override: 'request',
            nochange: undefined, // Should keep the 'default' value
            remove: null, // Should remove the 'default' value
            add: 'new',
            removeinurl: null,
            removeinbase: null,
          },
        }
      )
      const calledUrl = res.data.url
      const url = new URL(calledUrl)
      const params = Object.fromEntries(url.searchParams.entries())

      expect(params.keep).toBe('default') // Not overridden
      expect(params.nochange).toBe('default') // Not changed
      expect(params.override).toBe('request') // Overridden by request
      expect(params.overrideinbase).toBe('url') // Overridden by baseURL
      expect(params.add).toBe('new') // Added by request
      expect(params.addedinurl).toBe('yes') // Added in URL
      expect(params.remove).toBeUndefined() // Removed by undefined
      expect(params.removeinurl).toBeUndefined() // Removed by undefined
      expect(params.removeinbase).toBeUndefined() // Removed by undefined
    })

    it('should match the documentation example', async () => {
      const fexios = new Fexios({
        baseURL: 'https://example.com/?from=baseURL',
        fetch: mockFetch,
        query: {
          from: 'defaultOptions',
        },
      })

      const res = await fexios.get('/path?from=requestURL', {
        query: {
          from: 'requestOptions',
        },
      })
      const calledUrl = res.data.url
      expect(calledUrl).toBe('https://example.com/path?from=requestOptions')
    })

    it('undefined means no-change, null means remove for query in hooks', async () => {
      const fx = new Fexios({
        baseURL: 'https://example.com/?a=baseURL&keep=baseKeep&rm=baseRemove',
        fetch: mockFetch,
        query: { a: 'baseQuery', keep: 'baseKeep', rm: 'baseRemove' },
      })

      fx.on('beforeRequest', (ctx) => {
        // Introduce URL-level param; will be lower than ctx.query unless ctx.query uses undefined
        ctx.url = '/path?u=urlOnly&a=hookURL'
        // Apply undefined (no change) and null (remove) at highest layer
        ctx.query = {
          ...ctx.query,
          a: undefined, // should keep from URL (hookURL), not override
          keep: undefined, // should keep baseKeep
          rm: null, // should remove
          add: 'yes',
        }
        return ctx
      })

      const res = await fx.get('/ignored?keep=reqKeep', {
        query: { a: 'request', extra: 'req' },
      })
      const calledUrl = res.data.url
      const url = new URL(calledUrl)
      const params = Object.fromEntries(url.searchParams.entries())

      // undefined => no change (keep value from URL layer introduced in hook)
      expect(params.a).toBe('hookURL')
      // undefined => keep base value since request URL attempted override is lower than ctx.query undefined (no change)
      expect(params.keep).toBe('reqKeep')
      // null => removed finally
      expect(params.rm).toBeUndefined()
      // New value from hook
      expect(params.add).toBe('yes')
      // Still contains url-only param since not overridden
      expect(params.u).toBe('urlOnly')
      // request option extra preserved
      expect(params.extra).toBe('req')
    })

    it('should follow layering without hooks (ctx.query > ctx.url > baseConfigs.query > baseConfigs.url)', async () => {
      const fx = new Fexios({
        baseURL:
          'https://example.com/?from=baseURL&keep=baseKeep&remove=baseRemove',
        fetch: mockFetch,
        query: {
          from: 'baseQuery',
          keep: 'baseKeep',
          remove: 'baseRemove',
          onlyBase: 'yes',
        },
      })
      const res = await fx.get('/path?from=requestURL&u=urlOnly', {
        query: {
          from: 'requestQuery', // highest among layers (no hooks): should win
          keep: undefined, // keep baseQuery's keep
          remove: null, // remove whatever existed
          add: 'new',
        },
      })
      const calledUrl = res.data.url
      const url = new URL(calledUrl)
      const params = Object.fromEntries(url.searchParams.entries())

      expect(params.from).toBe('requestQuery')
      expect(params.keep).toBe('baseKeep')
      expect(params.remove).toBeUndefined()
      expect(params.add).toBe('new')
      // url-only exists but lower than ctx.query; should still present if not overridden
      expect(params.u).toBe('urlOnly')
      // base-only exists if not removed
      expect(params.onlyBase).toBe('yes')
    })

    it('should follow layering with hooks (ctx.query > ctx.url > baseConfigs.query > baseConfigs.url)', async () => {
      const fx = new Fexios({
        baseURL:
          'https://example.com/?from=baseURL&keep=baseKeep&remove=baseRemove',
        fetch: mockFetch,
        query: {
          from: 'baseQuery',
          keep: 'baseKeep',
          remove: 'baseRemove',
          baseOnly: 'yes',
        },
      })

      // mutate in hook: set both url (with search) and query, query should win
      fx.on('beforeRequest', (ctx) => {
        // add search via url
        ctx.url =
          ctx.url + (ctx.url.includes('?') ? '&' : '?') + 'from=hookURL&u2=url2'
        // override and delete via query
        ctx.query = {
          ...ctx.query,
          from: 'hookQuery', // highest
          keep: undefined, // keep base keep
          remove: null, // delete
          add: 'fromHook',
        }
        return ctx
      })

      const res = await fx.get('/path?from=requestURL&keep=reqKeep', {
        query: {
          from: 'requestQuery', // request options; lower than hook's ctx.query
          add: 'fromRequest',
        },
      })
      const calledUrl = res.data.url
      const url = new URL(calledUrl)
      const params = Object.fromEntries(url.searchParams.entries())

      expect(params.from).toBe('hookQuery')
      expect(params.keep).toBe('reqKeep')
      expect(params.remove).toBeUndefined()
      expect(params.add).toBe('fromHook')
      // url param from hook still present if not overridden by query
      expect(params.u2).toBe('url2')
      // base-only remains
      expect(params.baseOnly).toBe('yes')
    })
  })

  describe('Headers priority layering', () => {
    it('ctx.headers (including hook) should override request options and baseConfigs', async () => {
      const fx = new Fexios({
        baseURL: 'https://api.example.com',
        fetch: mockFetch,
        headers: {
          'X-Default': 'base',
          'X-Del': 'will',
          'X-Case': 'lower',
        },
      })

      fx.on('beforeRequest', (ctx) => {
        ctx.headers = {
          ...(ctx.headers as any),
          'X-Default': 'hook',
          'X-Hook': '1',
        } as any
        return ctx
      })

      const res = await fx.get('/h', {
        headers: {
          'X-Default': 'request',
          'X-Del': null, // delete
          'x-case': 'UP', // case-insensitive override
        },
      })

      const headersObject = res.data.headers

      expect(headersObject['x-default']).toBe('hook') // hook wins
      expect(headersObject['x-del']).toBeUndefined() // deleted by request options
      expect(headersObject['x-case']).toBe('UP') // request options override base
      expect(headersObject['x-hook']).toBe('1') // added in hook
    })

    it('undefined means no-change, null means remove for headers in hooks and request options', async () => {
      const fx = new Fexios({
        baseURL: 'https://api.example.com',
        fetch: mockFetch,
        headers: {
          'X-Base': 'B',
          'X-Keep': 'K',
          'X-Remove': 'R',
        },
      })

      fx.on('beforeRequest', (ctx) => {
        ctx.headers = {
          ...(ctx.headers as any),
          'X-Base': 'HOOK', // highest
          'X-Undefined': undefined, // no change (should not create)
          'X-Remove2': null, // remove
        } as any
        return ctx
      })

      const res = await fx.get('/h', {
        headers: {
          'X-Base': 'REQ',
          'X-Keep': undefined, // no change (keep K)
          'X-Remove': null, // remove
          'X-Undefined': undefined, // no-op
        },
      })

      const headersObject = res.data.headers

      // Highest (hook) wins
      expect(headersObject['x-base']).toBe('HOOK')
      // undefined => keep
      expect(headersObject['x-keep']).toBe('K')
      // null => removed
      expect(headersObject['x-remove']).toBeUndefined()
      // null in hook => removed
      expect(headersObject['x-remove2']).toBeUndefined()
      // undefined in both => not created
      expect(headersObject['x-undefined']).toBeUndefined()
    })
  })
})

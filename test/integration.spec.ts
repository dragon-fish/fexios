import {
  describe,
  expect,
  it,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest'
import { Fexios } from '../src/index'

/**
 * Integration tests that involve actual HTTP requests with mocked fetch
 * These tests verify that merge logic works correctly in real request scenarios
 */

describe('Integration Tests - HTTP Requests with Merge Logic', () => {
  let mockFetch: any

  beforeAll(() => {
    mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    global.fetch = mockFetch
    Fexios.DEFAULT_CONFIGS.fetch = mockFetch as any
  })

  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterAll(() => {
    vi.restoreAllMocks()
    Fexios.DEFAULT_CONFIGS.fetch = globalThis.fetch
  })

  describe('Query parameters in HTTP requests', () => {
    it('should work with axios-like API where undefined values are ignored', async () => {
      // This simulates the usage pattern mentioned in the request
      const testFexios = new Fexios({
        baseURL: 'https://api.example.com',
        headers: { 'X-Removed': 'true' },
      })

      await testFexios.get('/foo?bar=1&qux=2', {
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

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('baz=test'),
        })
      )

      // URL should not contain bar since it was undefined
      const calledUrl = mockFetch.mock.calls[0][0].url
      expect(calledUrl).toContain('bar=1')
      expect(calledUrl).not.toContain('qux=')
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

    it('should handle array query parameters in actual requests', async () => {
      const testFexios = new Fexios({ baseURL: 'https://api.example.com' })

      await testFexios.get('/test', {
        query: {
          foo: ['bar', 'baz'],
          single: 'value',
        },
      })

      const calledUrl = mockFetch.mock.calls[0][0].url
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
      const testFexios = new Fexios({ baseURL: 'https://api.example.com' })

      await testFexios.get('/test', {
        query: {
          'arr[]': ['bar', 'baz'],
          single: 'value',
        },
      })

      const calledUrl = mockFetch.mock.calls[0][0].url
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
        headers: {
          Authorization: 'Bearer default-token',
          'X-Client': 'default-client',
          'Content-Type': 'application/json',
        },
      })

      await testFexios.post(
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

      const calledHeaders =
        mockFetch.mock.calls[0][1]?.headers ||
        mockFetch.mock.calls[0][0].headers
      const headersObject =
        calledHeaders instanceof Headers
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

      const calledHeaders =
        mockFetch.mock.calls[0][1]?.headers ||
        mockFetch.mock.calls[0][0].headers
      const headersObject =
        calledHeaders instanceof Headers
          ? Object.fromEntries(calledHeaders.entries())
          : calledHeaders

      // Headers should be case-insensitive, request options should win
      expect(headersObject['content-type']).toBe('text/plain')
      expect(headersObject['x-api-key']).toBe('request-key')
    })
  })

  describe('Priority handling in HTTP requests', () => {
    it('should respect priority while filtering undefined/null values', async () => {
      const testFexios = new Fexios({
        baseURL: 'https://api.example.com',
        query: {
          keep: 'default',
          nochange: 'default',
          override: 'default',
          remove: 'default',
        },
      })

      await testFexios.get('/path?override=url', {
        query: {
          override: 'request',
          nochange: undefined, // Should keep the 'default' value
          remove: null, // Should remove the 'default' value
          add: 'new',
        },
      })

      const calledUrl = mockFetch.mock.calls[0][0].url
      const url = new URL(calledUrl)
      const params = Object.fromEntries(url.searchParams.entries())

      expect(params.keep).toBe('default') // Not overridden
      expect(params.nochange).toBe('default') // Not changed
      expect(params.override).toBe('request') // Overridden by request
      expect(params.remove).toBeUndefined() // Removed by undefined
      expect(params.add).toBe('new') // Added by request
    })

    it('should match the documentation example', async () => {
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

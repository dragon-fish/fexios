import { describe, it, expect, beforeEach } from 'vitest'
import { Fexios } from '../fexios.js'
import cookieJarPlugin, { CookieJar, type CookieJarItem } from './CookieJar.js'
import { MOCK_FETCH_BASE_URL, mockFetch } from '../../test/mockFetch.js'

describe('Cookie Jar Plugin', () => {
  let fexios: Fexios
  let cookieJar: CookieJar

  beforeEach(() => {
    fexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })
    fexios.plugin(cookieJarPlugin)
    cookieJar = fexios.cookieJar
  })

  describe('CookieJar', () => {
    it('should be able to set and get cookies', () => {
      const cookie: CookieJarItem = {
        name: 'test',
        value: 'value123',
        domain: 'zh.wikipedia.org',
        path: '/',
      }

      cookieJar.setCookie(cookie)
      const retrieved = cookieJar.getCookie('test', 'zh.wikipedia.org', '/')

      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('test')
      expect(retrieved?.value).toBe('value123')
    })

    it('should be able to parse Set-Cookie headers', () => {
      const setCookieHeader =
        'sessionId=abc123; Path=/; Domain=zh.wikipedia.org; HttpOnly'

      cookieJar.parseSetCookieHeader(setCookieHeader, 'zh.wikipedia.org', '/')
      const cookie = cookieJar.getCookie('sessionId', 'zh.wikipedia.org', '/')

      expect(cookie).toBeDefined()
      expect(cookie?.name).toBe('sessionId')
      expect(cookie?.value).toBe('abc123')
      expect(cookie?.httpOnly).toBe(true)
    })

    it('should be able to generate Cookie headers', () => {
      cookieJar.setCookie({
        name: 'cookie1',
        value: 'value1',
        domain: 'zh.wikipedia.org',
        path: '/',
      })
      cookieJar.setCookie({
        name: 'cookie2',
        value: 'value2',
        domain: 'zh.wikipedia.org',
        path: '/',
      })

      const cookieHeader = cookieJar.getCookieHeader('zh.wikipedia.org', '/')
      expect(cookieHeader).toContain('cookie1=value1')
      expect(cookieHeader).toContain('cookie2=value2')
    })

    it('should be able to delete cookies', () => {
      cookieJar.setCookie({
        name: 'test',
        value: 'value',
        domain: 'zh.wikipedia.org',
        path: '/',
      })

      expect(cookieJar.getCookie('test', 'zh.wikipedia.org', '/')).toBeDefined()

      cookieJar.deleteCookie('test', 'zh.wikipedia.org', '/')

      expect(
        cookieJar.getCookie('test', 'zh.wikipedia.org', '/')
      ).toBeUndefined()
    })

    it('should be able to clear all cookies', () => {
      cookieJar.setCookie({
        name: 'test1',
        value: 'value1',
        domain: 'zh.wikipedia.org',
        path: '/',
      })
      cookieJar.setCookie({
        name: 'test2',
        value: 'value2',
        domain: 'zh.wikipedia.org',
        path: '/',
      })

      expect(cookieJar.getCookies()).toHaveLength(2)

      cookieJar.clear()

      expect(cookieJar.getCookies()).toHaveLength(0)
    })

    it('should be able to handle domain matching', () => {
      cookieJar.setCookie({
        name: 'test',
        value: 'value',
        domain: '.wikipedia.org',
        path: '/',
      })

      // Should match subdomains
      expect(cookieJar.getCookie('test', 'zh.wikipedia.org', '/')).toBeDefined()
      expect(cookieJar.getCookie('test', 'en.wikipedia.org', '/')).toBeDefined()

      // Should not match other domains
      expect(cookieJar.getCookie('test', 'example.com', '/')).toBeUndefined()
    })

    it('should be able to handle path matching', () => {
      cookieJar.setCookie({
        name: 'test',
        value: 'value',
        domain: 'zh.wikipedia.org',
        path: '/api',
      })

      // Should match subpaths
      expect(
        cookieJar.getCookie('test', 'zh.wikipedia.org', '/api')
      ).toBeDefined()
      expect(
        cookieJar.getCookie('test', 'zh.wikipedia.org', '/api/')
      ).toBeDefined()
      expect(
        cookieJar.getCookie('test', 'zh.wikipedia.org', '/api/test')
      ).toBeDefined()

      // Should not match other paths
      expect(
        cookieJar.getCookie('test', 'zh.wikipedia.org', '/')
      ).toBeUndefined()
      expect(
        cookieJar.getCookie('test', 'zh.wikipedia.org', '/other')
      ).toBeUndefined()
    })

    it('should be able to handle expires expiration time', () => {
      const futureDate = new Date()
      futureDate.setHours(futureDate.getHours() + 1) // Expires in 1 hour

      const pastDate = new Date()
      pastDate.setHours(pastDate.getHours() - 1) // Expired 1 hour ago

      // Set non-expired cookie
      cookieJar.setCookie({
        name: 'futureCookie',
        value: 'futureValue',
        domain: 'zh.wikipedia.org',
        path: '/',
        expires: futureDate,
      })

      // Set expired cookie
      cookieJar.setCookie({
        name: 'pastCookie',
        value: 'pastValue',
        domain: 'zh.wikipedia.org',
        path: '/',
        expires: pastDate,
      })

      // Non-expired cookie should be retrievable
      expect(
        cookieJar.getCookie('futureCookie', 'zh.wikipedia.org', '/')
      ).toBeDefined()

      // Expired cookie should not be retrievable
      expect(
        cookieJar.getCookie('pastCookie', 'zh.wikipedia.org', '/')
      ).toBeUndefined()

      // When getting all cookies, should only return non-expired ones
      const allCookies = cookieJar.getCookies('zh.wikipedia.org', '/')
      expect(allCookies).toHaveLength(1)
      expect(allCookies[0].name).toBe('futureCookie')
    })

    it('should be able to handle maxAge expiration time', () => {
      // Set cookie with maxAge of 1 second
      cookieJar.setCookie({
        name: 'shortLivedCookie',
        value: 'shortValue',
        domain: 'zh.wikipedia.org',
        path: '/',
        maxAge: 1, // Expires in 1 second
      })

      // Should be retrievable immediately
      expect(
        cookieJar.getCookie('shortLivedCookie', 'zh.wikipedia.org', '/')
      ).toBeDefined()

      // Should not be retrievable after 1.1 seconds
      setTimeout(() => {
        expect(
          cookieJar.getCookie('shortLivedCookie', 'zh.wikipedia.org', '/')
        ).toBeUndefined()
      }, 1100)
    })

    it('should be able to clean expired cookies', () => {
      const pastDate = new Date()
      pastDate.setHours(pastDate.getHours() - 1) // Expired 1 hour ago

      // Set expired cookie
      cookieJar.setCookie({
        name: 'expiredCookie1',
        value: 'expiredValue1',
        domain: 'zh.wikipedia.org',
        path: '/',
        expires: pastDate,
      })

      cookieJar.setCookie({
        name: 'expiredCookie2',
        value: 'expiredValue2',
        domain: 'zh.wikipedia.org',
        path: '/',
        expires: pastDate,
      })

      // Set non-expired cookie
      const futureDate = new Date()
      futureDate.setHours(futureDate.getHours() + 1)
      cookieJar.setCookie({
        name: 'validCookie',
        value: 'validValue',
        domain: 'zh.wikipedia.org',
        path: '/',
        expires: futureDate,
      })

      // Should have 3 cookies before cleanup
      expect(cookieJar.getAllCookies()).toHaveLength(3)

      // Clean expired cookies
      const cleanedCount = cookieJar.cleanExpiredCookies()
      expect(cleanedCount).toBe(2)

      // Should have only 1 valid cookie after cleanup
      expect(cookieJar.getAllCookies()).toHaveLength(1)
      expect(cookieJar.getAllCookies()[0].name).toBe('validCookie')
    })

    it('should be able to get all cookies (including expired ones)', () => {
      const pastDate = new Date()
      pastDate.setHours(pastDate.getHours() - 1)

      // Set expired cookie
      cookieJar.setCookie({
        name: 'expiredCookie',
        value: 'expiredValue',
        domain: 'zh.wikipedia.org',
        path: '/',
        expires: pastDate,
      })

      // Set non-expired cookie
      const futureDate = new Date()
      futureDate.setHours(futureDate.getHours() + 1)
      cookieJar.setCookie({
        name: 'validCookie',
        value: 'validValue',
        domain: 'zh.wikipedia.org',
        path: '/',
        expires: futureDate,
      })

      // getCookies should only return non-expired ones
      const validCookies = cookieJar.getCookies('zh.wikipedia.org', '/')
      expect(validCookies).toHaveLength(1)
      expect(validCookies[0].name).toBe('validCookie')

      // getAllCookies should return all cookies (including expired ones)
      const allCookies = cookieJar.getAllCookies('zh.wikipedia.org', '/')
      expect(allCookies).toHaveLength(2)
    })

    it('should be able to overwrite cookies with the same name instead of creating multiple cookies', () => {
      // First time setting cookie
      cookieJar.setCookie({
        name: 'testCookie',
        value: 'firstValue',
        domain: 'zh.wikipedia.org',
        path: '/',
      })

      // Verify first setting was successful
      let cookie = cookieJar.getCookie('testCookie', 'zh.wikipedia.org', '/')
      expect(cookie).toBeDefined()
      expect(cookie?.value).toBe('firstValue')

      // Second time setting cookie with same name, should overwrite the first one
      cookieJar.setCookie({
        name: 'testCookie',
        value: 'secondValue',
        domain: 'zh.wikipedia.org',
        path: '/',
      })

      // Verify only the second value exists
      cookie = cookieJar.getCookie('testCookie', 'zh.wikipedia.org', '/')
      expect(cookie).toBeDefined()
      expect(cookie?.value).toBe('secondValue')

      // Verify only one cookie with the same name exists
      const allCookies = cookieJar.getCookies('zh.wikipedia.org', '/')
      const testCookies = allCookies.filter((c) => c.name === 'testCookie')
      expect(testCookies).toHaveLength(1)
      expect(testCookies[0].value).toBe('secondValue')

      // Verify only one cookie with the same name in Cookie header
      const cookieHeader = cookieJar.getCookieHeader('zh.wikipedia.org', '/')
      const cookieMatches = cookieHeader.match(/testCookie=[^;]+/g)
      expect(cookieMatches).toHaveLength(1)
      expect(cookieMatches![0]).toBe('testCookie=secondValue')
    })
  })

  describe('Plugin Integration', () => {
    it('should be able to install cookie jar through plugin', () => {
      expect(cookieJar).toBeInstanceOf(CookieJar)
    })

    it('should be able to manually set cookies and send them with requests', async () => {
      // Set a test cookie
      cookieJar.setCookie({
        name: 'testCookie',
        value: 'testValue',
        domain: new URL(MOCK_FETCH_BASE_URL).hostname,
        path: '/',
      })

      fexios.on('beforeActualFetch', (ctx) => {
        expect(ctx.rawRequest?.headers.get('cookie')).toContain(
          'testCookie=testValue'
        )
        return ctx
      })

      await fexios('')
    })

    it('should be able to receive and store cookies from Set-Cookie headers', async () => {
      const now = Date.now()
      const res = await fexios.get(
        `/set-cookie?cookieName=timestamp&cookieValue=${now}`
      )
      expect(
        cookieJar.getCookie(
          'timestamp',
          new URL(MOCK_FETCH_BASE_URL).hostname,
          '/'
        )
      ).toBeDefined()
    })
  })
})

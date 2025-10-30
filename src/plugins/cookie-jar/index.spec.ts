import { beforeEach, describe, expect, it } from 'vitest'
import { pluginCookieJar } from './index.js'
import { CookieJar } from './CookieJar.js'
import { Fexios } from '@/fexios.js'
import { MOCK_FETCH_BASE_URL, mockFetch } from '@/../test/mockFetch'

describe('Cookie Jar Plugin Integration', () => {
  let fexios: Fexios
  let cookieJar: CookieJar

  beforeEach(() => {
    fexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })
    fexios.plugin(pluginCookieJar)
    cookieJar = fexios.cookieJar!
  })

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

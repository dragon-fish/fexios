import { FexiosPlugin } from '@/index.js'
import { CookieJar } from './CookieJar.js'

export * from './CookieJar.js'

declare module '@/index.js' {
  interface Fexios {
    cookieJar?: CookieJar
  }
}

export const pluginCookieJar: FexiosPlugin = {
  name: 'fexios-plugin-cookie-jar',
  install(app) {
    const cookieJar = new CookieJar()

    // Request interceptor: add cookies to request headers
    app.interceptors.request.use((ctx) => {
      const url = new URL(ctx.url!)
      const cookieHeader = cookieJar.getCookieHeader(url.hostname, url.pathname)

      if (cookieHeader) {
        ctx.headers = {
          ...ctx.headers,
          Cookie: cookieHeader,
        }
      }

      return ctx
    })

    // Response interceptor: parse Set-Cookie header
    app.interceptors.response.use((ctx) => {
      const url = new URL(ctx.url!)
      const headersAny = ctx.rawResponse?.headers as any
      const host = url.hostname
      const reqPath = url.pathname

      // Prefer undici's getSetCookie() when available
      const getSetCookie =
        typeof headersAny?.getSetCookie === 'function'
          ? headersAny.getSetCookie.bind(headersAny)
          : undefined

      if (getSetCookie) {
        const list: string[] = getSetCookie()
        if (Array.isArray(list) && list.length > 0) {
          for (const sc of list) {
            cookieJar.parseSetCookieHeader(sc, host, reqPath)
          }
        }
      } else {
        const setCookieHeader = ctx.rawResponse?.headers?.get('set-cookie')
        if (setCookieHeader) {
          cookieJar.parseSetCookieHeader(setCookieHeader, host, reqPath)
        }
      }

      return ctx
    })

    // Expose cookieJar instance on app for external access
    app.cookieJar = cookieJar

    return app
  },
}

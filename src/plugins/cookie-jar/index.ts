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
  install(fx) {
    const cookieJar = new CookieJar()

    // Expose cookieJar instance on app for external access
    fx.cookieJar = cookieJar

    // Request interceptor: add cookies to request headers
    fx.interceptors.request.use((ctx) => {
      if (!fx.cookieJar) {
        return
      }
      const url = new URL(ctx.url!)
      const cookieHeader = fx.cookieJar.getCookieHeader(
        url.hostname,
        url.pathname
      )

      if (cookieHeader) {
        ctx.headers = {
          ...ctx.headers,
          Cookie: cookieHeader,
        }
      }

      return ctx
    })

    // Response interceptor: parse Set-Cookie header
    fx.interceptors.response.use((ctx) => {
      if (!fx.cookieJar) {
        return
      }
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
            fx.cookieJar.parseSetCookieHeader(sc, host, reqPath)
          }
        }
      } else {
        const setCookieHeader = ctx.rawResponse?.headers?.get('set-cookie')
        if (setCookieHeader) {
          fx.cookieJar.parseSetCookieHeader(setCookieHeader, host, reqPath)
        }
      }

      return ctx
    })
  },
  uninstall(fx) {
    fx.cookieJar = undefined
  },
}

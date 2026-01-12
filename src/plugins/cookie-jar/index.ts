import type { FexiosHookHandler, FexiosPlugin } from '@/index.js'
import { CookieJar } from './CookieJar.js'

export * from './CookieJar.js'

const COOKIE_JAR_PLUGIN_UNINSTALLER = Symbol(
  'fexios-plugin-cookie-jar-uninstaller'
)

declare module 'fexios' {
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
    const onBeforeRequest: FexiosHookHandler<'beforeRequest'> = (ctx) => {
      if (!fx.cookieJar) {
        return
      }
      const url = new URL(ctx.request.url!)
      const cookieHeader = fx.cookieJar.getCookieHeader(
        url.hostname,
        url.pathname
      )

      if (cookieHeader) {
        ctx.request.headers = {
          ...(ctx.request.headers as any),
          Cookie: cookieHeader,
        }
      }

      return ctx
    }
    fx.on('beforeRequest', onBeforeRequest)

    // Response interceptor: parse Set-Cookie header
    const onAfterResponse: FexiosHookHandler<'afterResponse'> = (ctx) => {
      if (!fx.cookieJar) {
        return
      }
      const url = new URL(ctx.url!)
      const headersAny = ctx.response.rawResponse?.headers as any
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
        const setCookieHeader =
          ctx.response.rawResponse?.headers?.get('set-cookie')
        if (setCookieHeader) {
          fx.cookieJar.parseSetCookieHeader(setCookieHeader, host, reqPath)
        }
      }

      return ctx
    }
    fx.on('afterResponse', onAfterResponse)

    const uninstaller = () => {
      fx.off('beforeRequest', onBeforeRequest)
      fx.off('afterResponse', onAfterResponse)
      fx.cookieJar = undefined
    }
    ;(fx as any)[COOKIE_JAR_PLUGIN_UNINSTALLER] = uninstaller as () => void
  },
  uninstall(fx) {
    const uninstaller = (fx as any)[COOKIE_JAR_PLUGIN_UNINSTALLER] as
      | (() => void)
      | undefined
    if (typeof uninstaller === 'function') {
      uninstaller()
    }
  },
}

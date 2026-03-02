import type { FexiosContext } from '../types.js'

/**
 * Attach v5-compatible property aliases on a FexiosContext.
 *
 * These legacy aliases proxy to ctx.request.* and ctx.runtime.* so that
 * old code reading/writing ctx.url, ctx.headers, etc. still works.
 */
export function attachLegacyAliases(ctx: FexiosContext): void {
  const req = () => ctx.request as any
  const rt = () => ctx.runtime as any

  const define = (k: string, desc: PropertyDescriptor) => {
    try {
      Object.defineProperty(ctx as any, k, { configurable: true, ...desc })
    } catch {
      // ignore
    }
  }

  // request aliases
  define('url', {
    get: () => req().url,
    set: (v) => {
      req().url = v?.toString?.() ?? String(v)
    },
  })
  define('method', {
    get: () => req().method,
    set: (v) => (req().method = v),
  })
  define('headers', {
    get: () => req().headers,
    set: (v) => (req().headers = v),
  })
  define('query', { get: () => req().query, set: (v) => (req().query = v) })
  define('body', { get: () => req().body, set: (v) => (req().body = v) })
  define('baseURL', {
    get: () => req().baseURL,
    set: (v) => (req().baseURL = v),
  })
  define('timeout', {
    get: () => req().timeout,
    set: (v) => (req().timeout = v),
  })
  define('credentials', {
    get: () => req().credentials,
    set: (v) => (req().credentials = v),
  })
  define('cache', { get: () => req().cache, set: (v) => (req().cache = v) })
  define('mode', { get: () => req().mode, set: (v) => (req().mode = v) })
  define('fetch', { get: () => req().fetch, set: (v) => (req().fetch = v) })
  define('shouldThrow', {
    get: () => req().shouldThrow,
    set: (v) => (req().shouldThrow = v),
  })
  define('responseType', {
    get: () => req().responseType,
    set: (v) => (req().responseType = v),
  })

  // runtime aliases
  define('abortController', {
    get: () => rt().abortController,
    set: (v) => (rt().abortController = v),
  })
  define('customEnv', {
    get: () => rt().customEnv,
    set: (v) => (rt().customEnv = v),
  })

  // response aliases (pre-final)
  define('rawRequest', {
    get: () => req().rawRequest,
    set: (v) => (req().rawRequest = v),
  })
  define('data', {
    get: () =>
      (ctx as any).response ? (ctx as any).response.data : undefined,
    set: (v) => {
      // allow legacy tests/users to mutate ctx.data in afterResponse (even though readonly in FinalContext)
      if ((ctx as any).response) ((ctx as any).response as any).data = v
    },
  })
}

/**
 * Rewrite context property descriptors so the returned context matches
 * FexiosFinalContext (readonly url, data, headers, responseType, rawRequest).
 */
export function finalizeContext<T = any>(
  ctx: FexiosContext<T>,
  fallbackURL: string
): void {
  const response: any = (ctx as any).response
  const rawResponse: any = response?.rawResponse ?? (ctx as any).rawResponse
  const req: any = ctx.request as any

  Object.defineProperties(ctx as any, {
    url: { get: () => rawResponse?.url || fallbackURL },
    data: { get: () => response!.data },
    headers: { get: () => rawResponse!.headers },
    responseType: { get: () => response!.responseType },
    rawRequest: { get: () => req.rawRequest },
  })
}

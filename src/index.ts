/**
 * Fexios
 * @desc Fetch based HTTP client with similar API to axios for browser and Node.js
 *
 * @license MIT
 * @author dragon-fish <dragon-fish@qq.com>
 */

export class Fexios {
  hooks: Record<FexiosEvents, FexiosHook[]> = {
    beforeInit: [],
    beforeRequest: [],
    afterResponse: [],
  }
  readonly DEFAULT_CONFIGS: FexiosConfigs = {
    baseURL: '',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
    },
    query: {},
    responseType: 'json',
  }
  private METHODS_WITHOUT_BODY: FexiosMethods[] = ['get', 'head', 'options']
  // declare method shortcuts
  get!: FexiosShortcutMethodWithoutBody
  head!: FexiosShortcutMethodWithoutBody
  options!: FexiosShortcutMethodWithoutBody
  delete!: FexiosShortcutMethodWithBody
  post!: FexiosShortcutMethodWithBody
  put!: FexiosShortcutMethodWithBody
  patch!: FexiosShortcutMethodWithBody

  constructor(public baseConfigs: Partial<FexiosConfigs> = {}) {
    this.makeMethodShortcut('get')
      .makeMethodShortcut('post')
      .makeMethodShortcut('put')
      .makeMethodShortcut('patch')
      .makeMethodShortcut('delete')
      .makeMethodShortcut('head')
      .makeMethodShortcut('options')
  }

  private makeMethodShortcut(method: FexiosMethods) {
    Object.defineProperty(this, method, {
      value: (
        url: string | URL,
        bodyOrQuery?: Record<string, any> | string | URLSearchParams,
        options?: Partial<FexiosRequestOptions>
      ) => {
        if (
          this.METHODS_WITHOUT_BODY.includes(
            method.toLocaleLowerCase() as FexiosMethods
          )
        ) {
          options = bodyOrQuery as any
        } else {
          options = options || {}
          options.body = bodyOrQuery
        }
        return this.request(url, {
          ...options,
          method: method as FexiosMethods,
        })
      },
    })
    return this
  }

  async request<T = any>(
    url: string | URL,
    options?: Partial<FexiosRequestOptions>
  ): Promise<
    Omit<FexiosContext, 'data' | 'response' | 'rawResponse'> & {
      data: T
      response: FexiosResponse<T>
      rawResponse: Response
    }
  > {
    let ctx: FexiosContext = (options = options || {}) as any
    ctx.url = url.toString()
    ctx = await this.emit('beforeInit', ctx)

    const reqURL = new URL(
      url.toString(),
      options.baseURL || this.baseConfigs.baseURL || globalThis.location?.href
    )
    ctx.url = reqURL.toString()

    ctx.headers = this.mergeHeaders(
      this.baseConfigs.headers,
      options.headers
    ) as any
    ctx.query = this.mergeQuery(
      this.baseConfigs.query,
      reqURL.searchParams,
      options.query
    )

    reqURL.search = new URLSearchParams(ctx.query as any).toString()
    ctx.url = reqURL.toString()

    if (
      this.METHODS_WITHOUT_BODY.includes(
        ctx.method?.toLocaleLowerCase() as FexiosMethods
      ) &&
      ctx.body
    ) {
      throw new FexiosError(
        'BODY_NOT_ALLOWED',
        `Request method "${ctx.method}" does not allow body`
      )
    }

    const requestInit: RequestInit = {
      method: ctx.method || 'GET',
      credentials: ctx.credentials,
      headers: ctx.headers,
    }

    // Automatically transform JSON object to JSON string
    if (ctx.body) {
      requestInit.body =
        ctx.body instanceof FormData || ctx.body instanceof URLSearchParams
          ? ctx.body
          : JSON.stringify(ctx.body)
    }

    // Adjust content-type header
    if (ctx.body instanceof FormData) {
      ;(ctx.headers as any)['content-type'] = 'multipart/form-data'
    } else if (ctx.body instanceof URLSearchParams) {
      ;(ctx.headers as any)['content-type'] =
        'application/x-www-form-urlencoded; charset=UTF-8'
    } else if (typeof ctx.body === 'object') {
      ;(ctx.headers as any)['content-type'] = 'application/json; charset=UTF-8'
    }

    const rawRequest = new Request(ctx.url, requestInit)
    ctx.rawRequest = rawRequest

    ctx = await this.emit('beforeRequest', ctx)

    const rawResponse = await fetch(ctx.rawRequest!).catch((err) => {
      throw new FexiosError('NETWORK_ERROR', err.message, ctx)
    })

    ctx.rawResponse = rawResponse
    ctx.response = await createFexiosResponse(rawResponse, ctx.responseType)
    ctx.data = ctx.response.data

    return this.emit('afterResponse', ctx) as any
  }

  mergeQuery(
    base: Record<string, any> | string | URLSearchParams | undefined,
    ...income: (Record<string, any> | string | URLSearchParams | undefined)[]
  ): Record<string, any> {
    const baseQuery = new URLSearchParams(base)
    for (const incomeQuery of income) {
      const params = new URLSearchParams(incomeQuery)
      params.forEach((value, key) => {
        baseQuery.set(key, value)
      })
    }
    return Object.fromEntries(baseQuery)
  }
  mergeHeaders(
    base: Record<string, any> | Headers | undefined,
    ...income: (Record<string, any> | Headers | undefined)[]
  ): Record<string, any> {
    const headersObject: any = {}
    const baseHeaders = new Headers(base)
    for (const incomeHeaders of income) {
      const header = new Headers(incomeHeaders)
      header.forEach((value, key) => {
        baseHeaders.set(key, value)
      })
    }
    baseHeaders.forEach((value, key) => {
      headersObject[key] = value
    })
    return headersObject
  }

  async emit<C = FexiosContext>(event: FexiosEvents, context: C) {
    const hooks = this.hooks[event] || []
    try {
      for (const hook of hooks) {
        const ctx = await (hook as FexiosHook<C>)(context)
        if (ctx === false) {
          throw new FexiosError(
            'ABORTED_BY_HOOK',
            `Request aborted by hook "${hook.name}"`,
            context as FexiosContext
          )
        } else if (typeof ctx === 'object') {
          context = ctx as C
        } else {
          // @ts-ignore
          globalThis['con'.concat('sole')].warn(
            `Hook "${hook.name}" should return a context object or false to abort request`
          )
        }
      }
    } catch (e) {
      return Promise.reject(e)
    }
    return context
  }
  on<C = FexiosContext>(
    event: FexiosEvents,
    hook: FexiosHook<C>,
    prepend = false
  ) {
    if (typeof hook !== 'function') {
      throw new FexiosError(
        'INVALID_HOOK',
        `Hook "${hook}" should be a function`
      )
    }
    this.hooks[event] ??= []
    this.hooks[event][prepend ? 'unshift' : 'push'](hook as any)
    return this
  }

  get interceptors(): FexiosInterceptors {
    return {
      request: {
        use: <C = FexiosContext>(hook: FexiosHook<C>, prepend = false) => {
          return this.on('beforeRequest', hook, prepend)
        },
      },
      response: {
        use: <C = FexiosContext>(hook: FexiosHook<C>, prepend = false) => {
          return this.on('afterResponse', hook, prepend)
        },
      },
    }
  }

  extends(configs: Partial<FexiosConfigs>) {
    const fexios = new Fexios({ ...this.baseConfigs, ...configs })
    fexios.hooks = { ...this.hooks }
    return fexios
  }

  static create(configs?: Partial<FexiosConfigs>) {
    return new Fexios(configs)
  }
}

export class FexiosError extends Error {
  name = 'FexiosError'
  constructor(
    public code: string,
    message?: string,
    public context?: FexiosContext
  ) {
    super(message)
  }
}
export class FexiosResponseError<T> extends Error {
  name = 'FexiosResponseError'
  code: string

  constructor(message: string, public response: FexiosResponse<T>) {
    super(message)
    this.code = response.statusText
  }
}

export async function createFexiosResponse<T = any>(
  rawResponse: Response,
  contentType = 'json'
): Promise<FexiosResponse<T>> {
  let data: T
  if (contentType === 'blob') {
    data = (await rawResponse
      .clone()
      .blob()
      .catch(() => {
        // do nothing
      })) as T
  }
  // @ts-expect-error
  if (!data) {
    data = (await rawResponse
      .clone()
      .json()
      .catch(() => {
        return rawResponse.clone().text()
      })) as T
  }

  const isGood =
    rawResponse.ok && rawResponse.status >= 200 && rawResponse.status < 300

  const r: FexiosResponse<T> = {
    rawResponse,
    data,
    ok: rawResponse.ok,
    status: rawResponse.status,
    isGood,
    statusText: rawResponse.statusText,
    headers: rawResponse.headers,
  }

  if (!isGood) {
    throw new FexiosResponseError(
      `Request failed with status code ${rawResponse.status}`,
      r as any
    )
  }
  return r
}

// Support for direct import
export default createFexios()
export function createFexios(configs?: Partial<FexiosConfigs>) {
  return Fexios.create(configs)
}
// Set global fexios instance for browser
declare global {
  interface Window {
    fexios: Fexios
  }
}
if (typeof window !== 'undefined') {
  window.fexios = createFexios()
}

export type AwaitAble<T = unknown> = Promise<T> | T
export type FexiosConfigs = {
  baseURL: string
  query: Record<string, string | number | boolean> | URLSearchParams
  headers: Record<string, string> | Headers
  credentials: 'omit' | 'same-origin' | 'include'
  responseType: 'json' | 'blob' | 'text'
}
export interface FexiosRequestOptions {
  baseURL?: string
  method?: FexiosMethods
  credentials?: 'omit' | 'same-origin' | 'include'
  headers?: Record<string, string> | Headers
  query?: Record<string, string | number | boolean> | URLSearchParams
  body?: Record<string, any> | string | FormData | URLSearchParams
  responseType?: 'json' | 'blob' | 'text'
}
export interface FexiosContext<T = any> extends FexiosRequestOptions {
  url: string
  rawRequest?: Request
  rawResponse?: Response
  response?: FexiosResponse
  data?: T
}
export type FexiosResponse<T = any> = {
  rawResponse: Response
  ok: boolean
  status: number
  statusText: string
  headers: Headers
  isGood: boolean
  data: T
}
export type FexiosHook<C = unknown> = (context: C) => AwaitAble<C | false>
export type FexiosEvents = 'beforeInit' | 'beforeRequest' | 'afterResponse'
export type FexiosEventsMap = {
  init: FexiosHook<FexiosConfigs>[]
}
export type FexiosInterceptors = {
  request: {
    use: <C = FexiosContext>(hook: FexiosHook<C>, prepend?: boolean) => Fexios
  }
  response: {
    use: <C = FexiosContext>(hook: FexiosHook<C>, prepend?: boolean) => Fexios
  }
}
export type FexiosMethods =
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch'
  | 'head'
  | 'options'
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS'

type FexiosShortcutMethodWithoutBody = <T = any>(
  url: string | URL,
  options?: Partial<FexiosRequestOptions>
) => Promise<FexiosResponse<T>>
type FexiosShortcutMethodWithBody = <T = any>(
  url: string | URL,
  body: Record<string, any> | string | URLSearchParams | FormData,
  options?: Partial<FexiosRequestOptions>
) => Promise<FexiosResponse<T>>

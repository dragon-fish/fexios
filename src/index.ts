/**
 * Fexios
 * @desc Fetch based HTTP client with similar API to axios for browser and Node.js
 *
 * @license MIT
 * @author dragon-fish <dragon-fish@qq.com>
 */

export class Fexios {
  protected hooks: FexiosHookStore[] = []
  readonly DEFAULT_CONFIGS: FexiosConfigs = {
    baseURL: '',
    timeout: 60 * 1000,
    credentials: 'same-origin',
    headers: {},
    query: {},
    responseType: 'json',
  }
  private readonly ALL_METHODS: FexiosMethods[] = [
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'head',
    'options',
    'trace',
  ]
  private readonly METHODS_WITHOUT_BODY: FexiosMethods[] = [
    'get',
    'head',
    'options',
    'trace',
  ]

  constructor(public baseConfigs: Partial<FexiosConfigs> = {}) {
    this.ALL_METHODS.forEach(this.createMethodShortcut.bind(this))
  }

  async request<T = any>(
    url: string | URL,
    options?: Partial<FexiosRequestOptions>
  ): Promise<FexiosFinalContext<T>> {
    let ctx: FexiosContext = (options = options || {}) as any
    ctx.url = url.toString()
    ctx = await this.emit('beforeInit', ctx)

    const baseUrlString =
      options.baseURL || this.baseConfigs.baseURL || globalThis.location?.href
    const baseURL = baseUrlString
      ? new URL(baseUrlString, globalThis.location?.href)
      : undefined
    const reqURL = new URL(ctx.url.toString(), baseURL)
    ctx.url = reqURL.href
    ctx.baseURL = baseURL ? baseURL.href : reqURL.origin

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

    ctx = await this.emit('beforeRequest', ctx)

    let body: string | FormData | URLSearchParams | Blob | undefined
    if (typeof ctx.body !== 'undefined' && ctx.body !== null) {
      // Automatically transform JSON object to JSON string
      if (
        ctx.body instanceof Blob ||
        ctx.body instanceof FormData ||
        ctx.body instanceof URLSearchParams
      ) {
        body = ctx.body
      } else if (typeof ctx.body === 'object') {
        body = JSON.stringify(ctx.body)
        ;(ctx.headers as any)['content-type'] =
          'application/json; charset=UTF-8'
      } else {
        body = ctx.body
      }
    }

    // Adjust content-type header
    if (!(options.headers as any)?.['content-type'] && body) {
      // If body is FormData or URLSearchParams, simply delete content-type header to let Request constructor handle it
      if (!(body instanceof FormData || body instanceof URLSearchParams)) {
        delete (ctx.headers as any)['content-type']
      }
      // If body is a string and ctx.body is an object, it means ctx.body is a JSON string
      else if (typeof body === 'string' && typeof ctx.body === 'object') {
        ;(ctx.headers as any)['content-type'] =
          'application/json; charset=UTF-8'
      }
      // If body is a Blob, set content-type header to the Blob's type
      else if (body instanceof Blob) {
        ;(ctx.headers as any)['content-type'] = body.type
      }
    }

    ctx.body = body
    ctx = await this.emit('afterBodyTransformed', ctx)

    const abortController =
      ctx.abortController || globalThis.AbortController
        ? new AbortController()
        : undefined
    const rawRequest = new Request(ctx.url, {
      method: ctx.method || 'GET',
      credentials: ctx.credentials,
      headers: ctx.headers,
      body: ctx.body as any,
      signal: abortController?.signal,
    })
    ctx.rawRequest = rawRequest

    ctx = await this.emit('beforeActualFetch', ctx)

    const timeout = ctx.timeout || this.baseConfigs.timeout || 60 * 1000
    const timer = setTimeout(() => {
      abortController?.abort()
      if (!abortController) {
        throw new FexiosError(
          'TIMEOUT',
          `Request timed out after ${timeout}ms`,
          ctx
        )
      }
    }, timeout)
    const rawResponse = await fetch(ctx.rawRequest!)
      .catch((err) => {
        throw new FexiosError('NETWORK_ERROR', err.message, ctx)
      })
      .finally(() => {
        clearTimeout(timer)
      })

    ctx.rawResponse = rawResponse
    ctx.response = await createFexiosResponse(rawResponse, ctx.responseType)
    ctx.data = ctx.response.data
    ctx.headers = ctx.response.headers

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

  async emit<C = FexiosContext>(event: FexiosLifecycleEvents, ctx: C) {
    const hooks = this.hooks.filter((hook) => hook.event === event)
    try {
      let index = 0
      for (const hook of hooks) {
        const hookName = `${event}#${hook.action.name || index}`

        // Set a symbol to check if the hook overrides the original context
        const symbol = Symbol('FexiosHookContext')
        ;(ctx as any).__hook_symbol__ = symbol

        const newCtx = await (hook.action.bind(this) as FexiosHook<C>)(ctx)

        // Check if the hook overrides the original context
        if ((ctx as any).__hook_symbol__ !== symbol) {
          throw new FexiosError(
            'HOOK_CONTEXT_CHANGED',
            `Hook "${hookName}" should not override the original FexiosContext object.`
          )
        }

        // Excepted abort signal
        if (newCtx === false) {
          throw new FexiosError(
            'ABORTED_BY_HOOK',
            `Request aborted by hook "${hookName}"`,
            ctx as FexiosContext
          )
        }
        // Good
        else if (
          typeof newCtx === 'object' &&
          (newCtx as any).__hook_symbol__ === symbol
        ) {
          ctx = newCtx as C
        }
        // Unexpected return value
        else {
          // @ts-ignore prevent esbuild optimize
          const console = globalThis[''.concat('console')]
          try {
            throw new FexiosError(
              'UNEXPECTED_HOOK_RETURN',
              `Hook "${hookName}" should return the original FexiosContext or return false to abort the request, but got "${newCtx}".`
            )
          } catch (e: any) {
            console.warn(e.stack || e)
          }
        }

        // Clean up
        delete (ctx as any).__hook_symbol__

        index++
      }
    } catch (e) {
      return Promise.reject(e)
    }
    return ctx
  }
  on<C = FexiosContext>(
    event: FexiosLifecycleEvents,
    action: FexiosHook<C>,
    prepend = false
  ) {
    if (typeof action !== 'function') {
      throw new FexiosError(
        'INVALID_HOOK_CALLBACK',
        `Hook "${action}" should be a function, but got "${typeof action}"`
      )
    }
    this.hooks[prepend ? 'unshift' : 'push']({
      event,
      action: action as FexiosHook,
    })
    return this
  }

  private createInterceptor<T extends FexiosLifecycleEvents>(
    event: T
  ): FexiosInterceptor {
    return {
      handlers: () =>
        this.hooks
          .filter((hook) => hook.event === event)
          .map((hook) => hook.action),
      use: <C = FexiosContext>(hook: FexiosHook<C>, prepend = false) => {
        return this.on(event, hook, prepend)
      },
      clear: () => {
        this.hooks = this.hooks.filter((hook) => hook.event !== event)
      },
    }
  }
  readonly interceptors: FexiosInterceptors = {
    request: this.createInterceptor('beforeRequest'),
    response: this.createInterceptor('afterResponse'),
  }

  private createMethodShortcut(method: FexiosMethods) {
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

  extends(configs: Partial<FexiosConfigs>) {
    const fexios = new Fexios({ ...this.baseConfigs, ...configs })
    fexios.hooks = [...this.hooks]
    return fexios
  }

  create = Fexios.create
  static create(configs?: Partial<FexiosConfigs>) {
    return new Fexios(configs)
  }
}

// declare method shortcuts
export interface Fexios {
  get: FexiosRequestShortcut<'get'>
  post: FexiosRequestShortcut<'post'>
  put: FexiosRequestShortcut<'put'>
  patch: FexiosRequestShortcut<'patch'>
  delete: FexiosRequestShortcut<'delete'>
  head: FexiosRequestShortcut<'head'>
  options: FexiosRequestShortcut<'options'>
  trace: FexiosRequestShortcut<'trace'>
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
export class FexiosResponseError<T> extends FexiosError {
  name = 'FexiosResponseError'
  constructor(message: string, public response: FexiosResponse<T>) {
    super(response.statusText, message)
  }
}
/**
 * Check if the error is a FexiosError that not caused by Response error
 */
export const isFexiosError = (e: any): boolean => {
  return !(e instanceof FexiosResponseError) && e instanceof FexiosError
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

  const response: FexiosResponse<T> = {
    rawResponse,
    data,
    ok: rawResponse.ok,
    status: rawResponse.status,
    statusText: rawResponse.statusText,
    headers: rawResponse.headers,
  }

  if (!rawResponse.ok) {
    throw new FexiosResponseError(
      `Request failed with status code ${rawResponse.status}`,
      response as any
    )
  }
  return response
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
export interface FexiosConfigs {
  baseURL: string
  timeout: number
  query: Record<string, string | number | boolean> | URLSearchParams
  headers: Record<string, string> | Headers
  credentials: 'omit' | 'same-origin' | 'include'
  responseType: 'json' | 'blob' | 'text'
}
export interface FexiosRequestOptions extends FexiosConfigs {
  method?: FexiosMethods
  body?: Record<string, any> | string | FormData | URLSearchParams
  abortController?: AbortController
}
export interface FexiosContext<T = any> extends FexiosRequestOptions {
  url: string
  rawRequest?: Request
  rawResponse?: Response
  response?: FexiosResponse
  data?: T
}
export type FexiosFinalContext<T = any> = Omit<
  FexiosContext<T>,
  'rawResponse' | 'response' | 'data' | 'headers'
> & {
  rawResponse: Response
  response: FexiosResponse<T>
  headers: Headers
  data: T
}
export interface FexiosResponse<T = any> {
  rawResponse: Response
  ok: boolean
  status: number
  statusText: string
  headers: Headers
  data: T
}
export type FexiosHook<C = unknown> = (context: C) => AwaitAble<C | false>
export interface FexiosHookStore {
  event: FexiosLifecycleEvents
  action: FexiosHook
}
export type FexiosLifecycleEvents =
  | 'beforeInit'
  | 'beforeRequest'
  | 'afterBodyTransformed'
  | 'beforeActualFetch'
  | 'afterResponse'
export interface FexiosHooksNameMap {
  beforeInit: FexiosContext
  beforeRequest: FexiosContext
  afterBodyTransformed: FexiosContext
  beforeActualFetch: FexiosContext
  afterResponse: FexiosFinalContext
}
export interface FexiosInterceptor {
  handlers: () => FexiosHook[]
  use: <C = FexiosContext>(hook: FexiosHook<C>, prepend?: boolean) => Fexios
  clear: () => void
}
export interface FexiosInterceptors {
  request: FexiosInterceptor
  response: FexiosInterceptor
}

type LowerAndUppercase<T extends string> = Lowercase<T> | Uppercase<T>
export type FexiosMethods = LowerAndUppercase<
  'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | 'trace'
>

type MethodsWithoutBody = LowerAndUppercase<
  'get' | 'head' | 'options' | 'trace'
>
export type FexiosRequestShortcut<M extends FexiosMethods> =
  M extends MethodsWithoutBody ? ShortcutWithoutBody : ShortcutWithBody
type ShortcutWithoutBody = <T = any>(
  url: string | URL,
  options?: Partial<FexiosRequestOptions>
) => Promise<FexiosFinalContext<T>>
type ShortcutWithBody = <T = any>(
  url: string | URL,
  body?: Record<string, any> | string | URLSearchParams | FormData | null,
  options?: Partial<FexiosRequestOptions>
) => Promise<FexiosFinalContext<T>>

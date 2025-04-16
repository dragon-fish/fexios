import CallableInstance from 'callable-instance'
import { retry } from './utils/retry'

/**
 * Fexios
 * @desc Fetch based HTTP client with similar API to axios for browser and Node.js
 *
 * @license MIT
 * @author dragon-fish <dragon-fish@qq.com>
 */

export class Fexios extends CallableInstance<
  [
    string | URL | Partial<FexiosRequestOptions>,
    Partial<FexiosRequestOptions>?
  ],
  Promise<FexiosFinalContext<any>>
> {
  fetch: typeof fetch
  protected hooks: FexiosHookStore[] = []
  readonly DEFAULT_CONFIGS: FexiosConfigs = {
    baseURL: '',
    timeout: 60 * 1000,
    credentials: 'same-origin',
    headers: {},
    query: {},
    responseType: undefined,
    retry: 0,
    retryDelay: 0,
    shouldRetry: undefined,
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
    super('request')
    this.ALL_METHODS.forEach(this.createMethodShortcut.bind(this))
    this.fetch = baseConfigs.fetch || globalThis?.fetch || window?.fetch
    if (!this.fetch) {
      throw new Error(
        'Fetch API is not supported in this environment. Please provide a fetch implementation.'
      )
    }
  }

  async request<T = any>(
    url: string | URL,
    options?: Partial<FexiosRequestOptions>
  ): Promise<FexiosFinalContext<T>>
  async request<T = any>(
    options: Partial<FexiosRequestOptions> & { url: string | URL }
  ): Promise<FexiosFinalContext<T>>
  async request<T = any>(
    urlOrOptions:
      | string
      | URL
      | (Partial<FexiosRequestOptions> & { url: string | URL }),
    options?: Partial<FexiosRequestOptions>
  ): Promise<FexiosFinalContext<T>> {
    let ctx: FexiosContext = (options = options || {}) as any
    if (typeof urlOrOptions === 'string' || urlOrOptions instanceof URL) {
      ctx.url = urlOrOptions.toString()
    } else if (typeof urlOrOptions === 'object') {
      ctx = { ...urlOrOptions, ...ctx }
    }
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
        FexiosErrorCodes.BODY_NOT_ALLOWED,
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
      cache: ctx.cache,
      mode: ctx.mode,
      headers: ctx.headers,
      body: ctx.body as any,
      signal: abortController?.signal,
    })
    ctx.rawRequest = rawRequest

    ctx = await this.emit('beforeActualFetch', ctx)

    if (ctx.url.startsWith('ws')) {
      console.info('WebSocket:', ctx.url)
      const ws = new WebSocket(ctx.url)
      ctx.rawResponse = new Response()
      ctx.response = new FexiosResponse(ctx.rawResponse, ws as any, {
        ok: true,
        status: 101,
        statusText: 'Switching Protocols',
      })
      ctx.data = ws
      ctx.headers = new Headers()
      return this.emit('afterResponse', ctx) as any
    }

    const retries = options.retry ?? this.baseConfigs.retry ?? 0
    const retryDelay = options.retryDelay ?? this.baseConfigs.retryDelay ?? 0
    const shouldRetry =
      options.shouldRetry ??
      this.baseConfigs.shouldRetry ??
      this.defaultShouldRetry
    const fetchFn = async () => {
      const timeout = ctx.timeout || this.baseConfigs.timeout || 60 * 1000
      const timer = setTimeout(() => {
        abortController?.abort()
        if (!abortController) {
          throw new FexiosError(
            FexiosErrorCodes.TIMEOUT,
            `Request timed out after ${timeout}ms`,
            ctx
          )
        }
      }, timeout)
      const rawResponse = await this.fetch(ctx.rawRequest!).catch((err) => {
        throw new FexiosError(FexiosErrorCodes.NETWORK_ERROR, err.message, ctx)
      })

      ctx.rawResponse = rawResponse
      ctx.response = await Fexios.resolveResponseBody(
        rawResponse,
        ctx.responseType,
        (progress, buffer) => {
          console.info('Download progress:', progress)
          options?.onProgress?.(progress, buffer)
        }
      ).finally(() => {
        clearTimeout(timer)
      })
      ctx.data = ctx.response.data
      ctx.headers = ctx.response.headers

      return this.emit('afterResponse', ctx) as any
    }
    return retry(fetchFn, {
      retries,
      delay: retryDelay,
      shouldRetry,
      signal: abortController?.signal,
    })
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
        const hookName = `${event}#${hook.action.name || `anonymous#${index}`}`

        // Set a symbol to check if the hook overrides the original context
        const symbol = Symbol('FexiosHookContext')
        ;(ctx as any)[symbol] = symbol

        const newCtx = (await hook.action.call(this, ctx)) as Awaited<C | false>

        // Excepted abort signal
        if (newCtx === false) {
          throw new FexiosError(
            FexiosErrorCodes.ABORTED_BY_HOOK,
            `Request aborted by hook "${hookName}"`,
            ctx as FexiosContext
          )
        }
        // Good
        else if (
          typeof newCtx === 'object' &&
          (newCtx as any)[symbol] === symbol
        ) {
          ctx = newCtx as C
        }
        // Unexpected return value
        else {
          // @ts-ignore prevent esbuild optimize
          const console = globalThis[''.concat('console')]
          try {
            throw new FexiosError(
              FexiosErrorCodes.HOOK_CONTEXT_CHANGED,
              `Hook "${hookName}" should return the original FexiosContext or return false to abort the request, but got "${newCtx}".`
            )
          } catch (e: any) {
            console.warn(e.stack || e)
          }
        }

        // Clean up
        delete (ctx as any)[symbol]

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
        FexiosErrorCodes.INVALID_HOOK_CALLBACK,
        `Hook should be a function, but got "${typeof action}"`
      )
    }
    this.hooks[prepend ? 'unshift' : 'push']({
      event,
      action: action as FexiosHook,
    })
    return this
  }
  off(event: FexiosLifecycleEvents | '*' | null, action: FexiosHook<any>) {
    if (event === '*' || !event) {
      this.hooks = this.hooks.filter((hook) => hook.action !== action)
    } else {
      this.hooks = this.hooks.filter(
        (hook) => hook.event !== event || hook.action !== action
      )
    }
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

  static async resolveResponseBody<T = any>(
    rawResponse: Response,
    expectType?: FexiosConfigs['responseType'],
    onProgress?: (progress: number, buffer?: Uint8Array) => void
  ): Promise<FexiosResponse<T>> {
    if (rawResponse.bodyUsed) {
      throw new FexiosError(
        FexiosErrorCodes.BODY_USED,
        'Response body has already been used or locked'
      )
    }

    const contentType = rawResponse.headers.get('content-type') || ''
    const contentLength = Number(rawResponse.headers.get('content-length')) || 0

    // Check if the response is a WebSocket
    if (
      (rawResponse.status === 101 ||
        rawResponse.status === 426 ||
        rawResponse.headers.get('upgrade')) &&
      typeof globalThis.WebSocket !== 'undefined'
    ) {
      const ws = new WebSocket(rawResponse.url)
      await new Promise<any>((resolve, reject) => {
        ws.onopen = resolve
        ws.onerror = reject
      })
      return new FexiosResponse(rawResponse, ws as T, {
        ok: true,
        status: 101,
        statusText: 'Switching Protocols',
      })
    }
    // Check if the response is a EventSource
    // But only if the content-type is not 'text' or 'json'
    else if (
      contentType.startsWith('text/event-stream') &&
      !['text', 'json'].includes(expectType || '') &&
      typeof globalThis.EventSource !== 'undefined'
    ) {
      const es = new EventSource(rawResponse.url)
      await new Promise<any>((resolve, reject) => {
        es.onopen = resolve
        es.onerror = reject
      })
      return new FexiosResponse(rawResponse, es as T)
    }
    // Check if expectType is 'stream'
    else if (expectType === 'stream') {
      return new FexiosResponse(
        rawResponse,
        rawResponse.body as ReadableStream as T
      )
    }
    // Check if the response is a ReadableStream
    else {
      const reader = rawResponse.body?.getReader()
      if (!reader) {
        throw new FexiosError(
          FexiosErrorCodes.NO_BODY_READER,
          'Failed to get ReadableStream from response body'
        )
      }
      let buffer = new Uint8Array()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer = new Uint8Array([...buffer, ...value])
        if (onProgress && contentLength) {
          onProgress(buffer.length / contentLength, buffer)
        }
      }

      const res = new FexiosResponse(rawResponse, undefined as any)

      // Guess the response type, maybe a Blob?
      if (
        expectType === 'blob' ||
        contentType.startsWith('image/') ||
        contentType.startsWith('video/') ||
        contentType.startsWith('audio/') ||
        !this.isText(buffer)
      ) {
        res.data = new Blob([buffer], {
          type: rawResponse.headers.get('content-type') || undefined,
        }) as Blob as T
      }
      // Otherwise, try to decode the buffer as text
      else {
        res.data = new TextDecoder().decode(buffer) as T
      }

      // If the data resolved as a string above, try to parse it as JSON
      if (expectType === 'json' || contentType.startsWith('application/json')) {
        try {
          res.data = JSON.parse(res.data as string) as T
        } catch (e) {
          console.warn('Failed to parse response data as JSON:', e)
        }
      }
      if (typeof res.data === 'string' && expectType !== 'text') {
        const trimmedData = (res.data as string).trim()
        const firstChar = trimmedData[0]
        const lastChar = trimmedData[trimmedData.length - 1]
        if (
          (firstChar === '{' && lastChar === '}') ||
          (firstChar === '[' && lastChar === ']')
        ) {
          try {
            res.data = JSON.parse(res.data as string) as T
          } catch (_) {
            // NOOP
          }
        }
      }

      // Fall back to the buffer if the data is still not resolved
      if (typeof res.data === 'undefined') {
        res.data = buffer.length > 0 ? (buffer as any) : undefined
      }

      if (!res.ok) {
        throw new FexiosResponseError(
          `Request failed with status code ${rawResponse.status}`,
          res as any
        )
      } else {
        return res
      }
    }
  }

  static isText(uint8Array: Uint8Array, maxBytesToCheck = 1024) {
    // 确保输入是一个 Uint8Array
    if (!(uint8Array instanceof Uint8Array)) {
      throw new TypeError('Input must be a Uint8Array')
    }

    // 截取前 maxBytesToCheck 字节进行检查
    const dataToCheck = uint8Array.slice(0, maxBytesToCheck)

    // 使用 TextDecoder 尝试解码为 UTF-8 字符串
    const decoder = new TextDecoder('utf-8', { fatal: true })
    try {
      const decodedString = decoder.decode(dataToCheck)

      // 检查解码后的字符串是否包含大量不可打印字符
      const nonPrintableRegex = /[\x00-\x08\x0E-\x1F\x7F]/g // 匹配控制字符
      const nonPrintableMatches = decodedString.match(nonPrintableRegex)

      // 如果不可打印字符占比过高，则认为是二进制数据
      const threshold = 0.1 // 允许最多 10% 的不可打印字符
      if (
        nonPrintableMatches &&
        nonPrintableMatches.length / decodedString.length > threshold
      ) {
        return false // 是二进制数据
      }

      // 否则认为是文本数据
      return true
    } catch (error) {
      // 如果解码失败（例如包含无效的 UTF-8 序列），认为是二进制数据
      return false
    }
  }

  readonly DEFAULT_RETRY_STATUS_CODES = [408, 409, 425, 429, 500, 502, 503, 504]
  defaultShouldRetry(error: any, attempt: number) {
    if (error instanceof FexiosResponseError) {
      if (
        [FexiosErrorCodes.TIMEOUT, FexiosErrorCodes.ABORTED_BY_HOOK].includes(
          error.code as FexiosErrorCodes
        )
      ) {
        return false
      }
      return (
        this.DEFAULT_RETRY_STATUS_CODES.includes(error.response.status) ||
        error.response.status >= 500 ||
        error.code === FexiosErrorCodes.NETWORK_ERROR
      )
    }
    return false
  }

  extends(configs: Partial<FexiosConfigs>) {
    const fexios = new Fexios({ ...this.baseConfigs, ...configs })
    fexios.hooks = [...this.hooks]
    return fexios
  }

  readonly create = Fexios.create
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

export class FexiosResponse<T = any> {
  public ok: boolean
  public status: number
  public statusText: string
  public headers: Headers
  constructor(
    public rawResponse: Response,
    public data: T,
    overrides?: Partial<Omit<FexiosResponse<T>, 'rawResponse' | 'data'>>
  ) {
    this.ok = rawResponse.ok
    this.status = rawResponse.status
    this.statusText = rawResponse.statusText
    this.headers = rawResponse.headers
    Object.entries(overrides || {}).forEach(([key, value]) => {
      ;(this as any)[key] = value
    })
  }
}

export enum FexiosErrorCodes {
  BODY_USED = 'BODY_USED',
  NO_BODY_READER = 'NO_BODY_READER',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  BODY_NOT_ALLOWED = 'BODY_NOT_ALLOWED',
  HOOK_CONTEXT_CHANGED = 'HOOK_CONTEXT_CHANGED',
  ABORTED_BY_HOOK = 'ABORTED_BY_HOOK',
  INVALID_HOOK_CALLBACK = 'INVALID_HOOK_CALLBACK',
  UNEXPECTED_HOOK_RETURN = 'UNEXPECTED_HOOK_RETURN',
}
export class FexiosError extends Error {
  name = 'FexiosError'
  constructor(
    readonly code: FexiosErrorCodes | string,
    message?: string,
    readonly context?: FexiosContext,
    options?: ErrorOptions
  ) {
    super(message, options)
  }
}
export class FexiosResponseError<T> extends FexiosError {
  name = 'FexiosResponseError'
  constructor(
    message: string,
    readonly response: FexiosResponse<T>,
    options?: ErrorOptions
  ) {
    super(response.statusText, message, undefined, options)
  }
}
/**
 * Check if the error is a FexiosError that not caused by Response error
 */
export const isFexiosError = (e: any) => {
  return !(e instanceof FexiosResponseError) && e instanceof FexiosError
}
export const isFexiosResponseError = (e: any): boolean => {
  return e instanceof FexiosResponseError
}
export const getFexiosResponse = (e: any): FexiosResponse | undefined => {
  if (e instanceof FexiosResponse) {
    return e
  } else if (e?.response instanceof FexiosResponse) {
    return e.response
  } else if (e instanceof FexiosResponseError) {
    return e.context?.response
  }
}

// Support for direct import
export const createFexios = Fexios.create
export const fexios = createFexios()
export default fexios
// Set global fexios instance for browser
declare global {
  interface Window {
    fexios: Fexios
  }
  const fexios: Fexios
}
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).fexios = fexios
} else if (typeof window !== 'undefined') {
  window.fexios = fexios
}

export type AwaitAble<T = unknown> = Promise<T> | T
export interface FexiosConfigs {
  fetch?: typeof fetch
  baseURL: string
  timeout: number
  query: Record<string, string | number | boolean> | URLSearchParams
  headers: Record<string, string> | Headers
  credentials?: RequestInit['credentials']
  cache?: RequestInit['cache']
  mode?: RequestInit['mode']
  responseType?: 'json' | 'blob' | 'text' | 'stream'
  retry?: number
  retryDelay?: number
  shouldRetry?: (error: any, attempt: number) => boolean
}
export interface FexiosRequestOptions extends FexiosConfigs {
  url?: string | URL
  method?: FexiosMethods
  body?: Record<string, any> | string | FormData | URLSearchParams
  abortController?: AbortController
  onProgress?: (progress: number, buffer?: Uint8Array) => void
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

import CallableInstance from 'callable-instance'
import type {
  FexiosConfigs,
  FexiosContext,
  FexiosRequestOptions,
  FexiosFinalContext,
  FexiosMethods,
  FexiosHookStore,
  FexiosLifecycleEvents,
  FexiosHook,
  FexiosInterceptor,
  FexiosInterceptors,
  FexiosRequestShortcut,
} from './types'
import { FexiosError, FexiosErrorCodes } from './errors'
import { FexiosResponse, resolveResponseBody } from './response'
import { FexiosQueryBuilder } from './query-builder'
import { checkIsPlainObject, dropUndefinedAndNull } from './utils'

/**
 * Fexios
 * @desc Fetch based HTTP client with similar API to axios for browser and Node.js
 */
export class Fexios extends CallableInstance<
  [
    string | URL | Partial<FexiosRequestOptions>,
    Partial<FexiosRequestOptions>?
  ],
  Promise<FexiosFinalContext<any>>
> {
  protected hooks: FexiosHookStore[] = []
  static readonly DEFAULT_CONFIGS: FexiosConfigs = {
    baseURL: '',
    timeout: 60 * 1000,
    credentials: 'same-origin',
    headers: {},
    query: {},
    responseType: undefined,
    fetch: globalThis.fetch,
  }
  static readonly ALL_METHODS: FexiosMethods[] = [
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'head',
    'options',
    'trace',
  ]
  static readonly METHODS_WITHOUT_BODY: FexiosMethods[] = [
    'get',
    'head',
    'options',
    'trace',
  ]

  constructor(public baseConfigs: Partial<FexiosConfigs> = {}) {
    super('request')
    // TODO: Should be deep merge
    baseConfigs = { ...Fexios.DEFAULT_CONFIGS, ...baseConfigs }
    Fexios.ALL_METHODS.forEach(this.createMethodShortcut.bind(this))
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

    // Extract query parameters from different sources
    // Priority: requestOptions > requestURL > defaultOptions > baseURL
    const baseUrlQuery = baseURL?.searchParams
    // Create a copy of requestUrlQuery before clearing the URL search params
    const requestUrlQuery = new URLSearchParams(reqURL.searchParams)

    // Clear the URL search params temporarily
    reqURL.search = ''
    ctx.url = reqURL.href

    // prettier-ignore
    ctx.query = this.mergeQuery(
      baseUrlQuery,           // baseURL query (lowest priority)
      this.baseConfigs.query, // defaultOptions (baseOptions)
      requestUrlQuery,        // requestURL query (urlParams)
      options.query           // requestOptions (highest priority)
    )

    // Build search params with proper array handling
    reqURL.search = FexiosQueryBuilder.makeQueryString(ctx.query)
    ctx.url = reqURL.toString()

    if (
      Fexios.METHODS_WITHOUT_BODY.includes(
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
      } else if (typeof ctx.body === 'object' && ctx.body !== null) {
        body = JSON.stringify(ctx.body)
        ;(ctx.headers as any)['content-type'] = 'application/json'
      } else {
        body = ctx.body
      }
    }

    // Adjust content-type header
    if (!(options.headers as any)?.['content-type'] && body) {
      if (body instanceof FormData || body instanceof URLSearchParams) {
        // Let the browser automatically set content-type for FormData/URLSearchParams
        delete (ctx.headers as any)['content-type']
      } else if (typeof body === 'string' && typeof ctx.body === 'object') {
        ;(ctx.headers as any)['content-type'] = 'application/json'
      } else if (body instanceof Blob) {
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

    const timeout = ctx.timeout || this.baseConfigs.timeout || 60 * 1000

    if (ctx.url.startsWith('ws')) {
      console.info('WebSocket:', ctx.url)
      try {
        const ws = new WebSocket(ctx.url)

        // Wait for connection to establish or fail
        await new Promise<void>((resolve, reject) => {
          const connectionTimeout = setTimeout(() => {
            reject(
              new FexiosError(
                FexiosErrorCodes.TIMEOUT,
                `WebSocket connection timed out after ${timeout}ms`,
                ctx
              )
            )
          }, timeout)

          ws.onopen = () => {
            clearTimeout(connectionTimeout)
            resolve()
          }
          ws.onerror = (event) => {
            clearTimeout(connectionTimeout)
            reject(
              new FexiosError(
                FexiosErrorCodes.NETWORK_ERROR,
                `WebSocket connection failed`,
                ctx
              )
            )
          }
          ws.onclose = (event) => {
            // Only reject if the closure wasn't normal and we haven't resolved yet
            if (event.code !== 1000) {
              clearTimeout(connectionTimeout)
              reject(
                new FexiosError(
                  FexiosErrorCodes.NETWORK_ERROR,
                  `WebSocket closed with code ${event.code}`,
                  ctx
                )
              )
            }
          }
        })

        ctx.rawResponse = new Response()
        ctx.response = new FexiosResponse(ctx.rawResponse, ws as any, {
          ok: true,
          status: 101,
          statusText: 'Switching Protocols',
        })
        ctx.data = ws
        ctx.headers = new Headers()
        return this.emit('afterResponse', ctx) as any
      } catch (error) {
        if (error instanceof FexiosError) {
          throw error
        }
        throw new FexiosError(
          FexiosErrorCodes.NETWORK_ERROR,
          `WebSocket creation failed: ${error}`,
          ctx
        )
      }
    }

    let timer: NodeJS.Timeout | undefined

    try {
      if (abortController) {
        timer = setTimeout(() => {
          abortController.abort()
        }, timeout)
      }

      const fetch = options.fetch || this.baseConfigs.fetch || globalThis.fetch
      const rawResponse = await fetch(ctx.rawRequest!).catch((err) => {
        if (timer) clearTimeout(timer)
        if (abortController?.signal.aborted) {
          throw new FexiosError(
            FexiosErrorCodes.TIMEOUT,
            `Request timed out after ${timeout}ms`,
            ctx
          )
        }
        throw new FexiosError(FexiosErrorCodes.NETWORK_ERROR, err.message, ctx)
      })

      if (timer) clearTimeout(timer)

      ctx.rawResponse = rawResponse
      ctx.response = await resolveResponseBody(
        rawResponse,
        ctx.responseType,
        (progress, buffer) => {
          console.info('Download progress:', progress)
          options?.onProgress?.(progress, buffer)
        }
      )
      ctx.data = ctx.response.data
      ctx.headers = ctx.response.headers

      return this.emit('afterResponse', ctx) as any
    } catch (error) {
      if (timer) clearTimeout(timer)
      throw error
    }
  }

  mergeQuery(
    base: Record<string, any> | string | URLSearchParams | undefined,
    ...income: (Record<string, any> | string | URLSearchParams | undefined)[]
  ): Record<string, any> {
    const result: Record<string, any> = {}

    const processQuerySource = (source: typeof base) => {
      if (!source) return

      if (checkIsPlainObject(source)) {
        Object.entries(source).forEach(([key, value]) => {
          if (value === undefined || value === null) {
            delete result[key]
          } else if (Array.isArray(value)) {
            // Handle array values
            if (key.endsWith('[]')) {
              // For keys ending with '[]', keep multiple entries with the same key
              // Store as array to be processed later when building URLSearchParams
              result[key] = value.map(String)
            } else {
              // For regular keys, create multiple query parameters with the same name
              result[key] = value.map(String)
            }
          } else {
            result[key] = String(value)
          }
        })
      } else {
        const query = new URLSearchParams(source)
        query.forEach((value, key) => {
          result[key] = value
        })
      }
    }

    processQuerySource(base)
    income.forEach(processQuerySource)

    return result
  }

  mergeHeaders(
    base: Record<string, any> | Headers | undefined,
    ...income: (Record<string, any> | Headers | undefined)[]
  ): Record<string, string> {
    const obj: Record<string, string> = {}
    const baseHeaders = new Headers(base)
    for (const item of income) {
      if (item === undefined || item === null) continue

      const isPlainInput = checkIsPlainObject(item)
      if (isPlainInput) {
        const processedItem = dropUndefinedAndNull(item)
        // Skip if after processing, the object is empty
        if (Object.keys(processedItem).length === 0) continue

        const header = new Headers(processedItem as Record<string, string>)
        header.forEach((value, key) => {
          baseHeaders.set(key, value)
        })
      } else {
        const header = new Headers(item)
        header.forEach((value, key) => {
          baseHeaders.set(key, value)
        })
      }
    }
    baseHeaders.forEach((value, key) => {
      obj[key] = value
    })
    return obj
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

        let hookResult = (await hook.action.call(this, ctx)) as Awaited<
          C | void | false
        >
        if (hookResult === void 0) {
          hookResult = ctx as any
        }

        // Excepted abort signal
        if (hookResult === false) {
          throw new FexiosError(
            FexiosErrorCodes.ABORTED_BY_HOOK,
            `Request aborted by hook "${hookName}"`,
            ctx as FexiosContext
          )
        }
        // Good
        else if (
          typeof hookResult === 'object' &&
          (hookResult as any)[symbol] === symbol
        ) {
          ctx = hookResult as C
        }
        // Unexpected return value
        else {
          // @ts-ignore prevent esbuild optimize
          const console = globalThis[''.concat('console')]
          try {
            throw new FexiosError(
              FexiosErrorCodes.HOOK_CONTEXT_CHANGED,
              `Hook "${hookName}" should return the original FexiosContext or return false to abort the request, but got "${hookResult}".`
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
          Fexios.METHODS_WITHOUT_BODY.includes(
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

  readonly create = Fexios.create
  static create(configs?: Partial<FexiosConfigs>) {
    return new Fexios(configs)
  }

  /**
   * Remove all undefined and null properties from an object
   * Also handles empty strings based on options
   * @deprecated Use dropUndefinedAndNull from utils instead
   */
  readonly dropUndefinedAndNull = dropUndefinedAndNull

  /**
   * Check if given payload is a plain object
   * @deprecated Use checkIsPlainObject from utils instead
   */
  readonly checkIsPlainObject = checkIsPlainObject
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

import { CallableInstance } from './utils/callable-instance.js'
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
  FexiosLifecycleEventMap,
  FexiosPlugin,
} from './types'
import { FexiosError, FexiosErrorCodes } from './models/errors.js'
import {
  FexiosResponse,
  createFexiosResponse,
  createFexiosWebSocketResponse,
} from './models/response.js'
import { FexiosQueryBuilder } from './models/query-builder.js'
import { deepMerge } from './utils/deepMerge'
import { isPlainObject } from './utils/isPlainObject'
import { FexiosHeaderBuilder } from './models/header-builder'
import { clone } from './utils/clone.js'

/**
 * Fexios
 * @desc Fetch based HTTP client with similar API to axios for browser and Node.js
 */
export class Fexios extends CallableInstance<
  [
    string | URL | (Partial<FexiosRequestOptions> & { url: string | URL }),
    Partial<FexiosRequestOptions>?
  ],
  Promise<FexiosFinalContext<any>>
> {
  static readonly version = import.meta.env.__VERSION__
  private static readonly FINAL_SYMBOL = Symbol('FEXIOS_FINAL_CONTEXT')
  private static readonly NORMALIZED_SYMBOL = Symbol('FEXIOS_NORMALIZED_QUERY')
  public baseConfigs: FexiosConfigs
  // for axios compatibility
  get defaults() {
    return this.baseConfigs
  }
  set defaults(configs: FexiosConfigs) {
    this.baseConfigs = configs
  }
  static readonly DEFAULT_CONFIGS: FexiosConfigs = {
    baseURL: '',
    timeout: 60 * 1000,
    credentials: undefined,
    headers: {},
    query: {},
    responseType: undefined,
    shouldThrow(response) {
      return !response.ok
    },
    fetch: globalThis.fetch,
  }
  protected hooks: FexiosHookStore[] = []
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

  constructor(baseConfigs: Partial<FexiosConfigs> = {}) {
    super('request')
    this.baseConfigs = deepMerge(Fexios.DEFAULT_CONFIGS, baseConfigs)
    Fexios.ALL_METHODS.forEach((m) =>
      this.createMethodShortcut(m.toLowerCase() as Lowercase<FexiosMethods>)
    )
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
    let ctx: FexiosContext
    if (typeof urlOrOptions === 'string' || urlOrOptions instanceof URL) {
      ctx = deepMerge(
        this.baseConfigs,
        { url: urlOrOptions.toString() },
        options as Partial<FexiosContext>
      )
    } else if (typeof urlOrOptions === 'object') {
      ctx = deepMerge(this.baseConfigs, urlOrOptions as Partial<FexiosContext>)
    } else {
      ctx = clone(this.baseConfigs) as FexiosContext
    }
    ctx = await this.emit('beforeInit', ctx, {
      shouldAdjustRequestParams: true,
      shouldHandleShortCircuitResponse: true,
    })
    if ((ctx as any)[Fexios.FINAL_SYMBOL]) return ctx as any

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

    ctx = await this.emit('beforeRequest', ctx, {
      shouldAdjustRequestParams: true,
      shouldHandleShortCircuitResponse: true,
      preAdjust: true,
      requestOptionsOverridesURLSearchParams: true,
      preRequestOptionsOverridesURLSearchParams: true,
      postRequestOptionsOverridesURLSearchParams: true,
    })
    if ((ctx as any)[Fexios.FINAL_SYMBOL]) return ctx as any

    let body: string | FormData | URLSearchParams | Blob | undefined
    const headerAutoPatch: Record<string, unknown> = {}
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
        ctx.headers = this.mergeHeaders(ctx.headers, {
          'Content-Type': 'application/json',
        })
      } else {
        body = ctx.body
      }
    }

    // Adjust content-type header
    const optionsHeaders = FexiosHeaderBuilder.makeHeaders(ctx.headers || {})
    if (!optionsHeaders.get('content-type') && body) {
      if (body instanceof FormData || body instanceof URLSearchParams) {
        // Let the browser automatically set content-type for FormData/URLSearchParams
        headerAutoPatch['content-type'] = null
      } else if (typeof body === 'string' && typeof ctx.body === 'object') {
        headerAutoPatch['content-type'] = 'application/json'
      } else if (body instanceof Blob) {
        headerAutoPatch['content-type'] =
          body.type || 'application/octet-stream'
      }
    }

    ctx.body = body
    ctx = await this.emit('afterBodyTransformed', ctx, {
      shouldAdjustRequestParams: true,
      shouldHandleShortCircuitResponse: true,
      preAdjust: true,
      postRequestOptionsOverridesURLSearchParams: true,
    })
    if ((ctx as any)[Fexios.FINAL_SYMBOL]) return ctx as any

    const abortController =
      ctx.abortController || globalThis.AbortController
        ? new AbortController()
        : undefined
    // Build final URL from ctx.url (without search) and ctx.query
    const baseUrlStringForRequest =
      ctx.baseURL ||
      this.baseConfigs.baseURL ||
      globalThis.location?.href ||
      'http://localhost'
    const urlObjForRequest = new URL(
      ctx.url.toString(),
      baseUrlStringForRequest
    )
    const finalURLForRequest = FexiosQueryBuilder.makeURL(
      urlObjForRequest,
      (ctx as any as FexiosContext).query,
      urlObjForRequest.hash
    ).toString()

    const rawRequest = new Request(finalURLForRequest, {
      method: ctx.method || 'GET',
      credentials: ctx.credentials,
      cache: ctx.cache,
      mode: ctx.mode,
      headers: FexiosHeaderBuilder.mergeHeaders(
        this.baseConfigs.headers,
        ctx.headers || {},
        headerAutoPatch
      ),
      body: ctx.body as any,
      signal: abortController?.signal,
    })
    ctx.rawRequest = rawRequest

    ctx = await this.emit('beforeActualFetch', ctx, {
      shouldHandleShortCircuitResponse: true,
    })
    if ((ctx as any)[Fexios.FINAL_SYMBOL]) return ctx as any

    const timeout = ctx.timeout || this.baseConfigs.timeout || 60 * 1000

    if (ctx.url.startsWith('ws') || ctx.responseType === 'ws') {
      const response = await createFexiosWebSocketResponse(
        ctx.url,
        undefined,
        ctx.timeout
      )
      const finalCtx = {
        ...ctx,
        response,
        rawResponse: undefined!,
        data: response.data,
        headers: response.headers,
      } as FexiosFinalContext<WebSocket>
      return this.emit('afterResponse', finalCtx)
    }

    let timer: ReturnType<typeof setTimeout> | undefined

    try {
      if (abortController) {
        timer = setTimeout(() => {
          abortController.abort()
        }, timeout)
      }

      const fetch = ctx.fetch || this.baseConfigs.fetch || globalThis.fetch
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
      ctx.response = await createFexiosResponse(
        rawResponse,
        ctx.responseType,
        (progress, buffer) => {
          console.info('Download progress:', progress)
          options?.onProgress?.(progress, buffer)
        }
      )
      ctx.data = ctx.response.data
      ctx.headers = ctx.response.headers
      ctx.responseType = ctx.response.responseType

      console.info('afterResponse', ctx.responseType, ctx.data)

      return this.emit('afterResponse', ctx) as any
    } catch (error) {
      if (timer) clearTimeout(timer)
      throw error
    }
  }

  mergeQueries = FexiosQueryBuilder.mergeQueries
  mergeHeaders = FexiosHeaderBuilder.mergeHeaders

  private normalizeContext(
    ctx: FexiosContext,
    opts: Partial<{
      requestOptionsOverridesURLSearchParams: boolean
    }> = {}
  ): FexiosContext {
    const c = ctx as FexiosContext
    const baseUrlString =
      c.baseURL || globalThis.location?.href || 'http://localhost'
    const baseURL = new URL(
      baseUrlString,
      globalThis.location?.href || 'http://localhost'
    )
    const reqURL = new URL(c.url.toString(), baseURL)

    const alreadyNormalized = Boolean((c as any)[Fexios.NORMALIZED_SYMBOL])

    c.baseURL = baseURL ? baseURL.origin : reqURL.origin

    let finalQuery: Record<string, any>
    if (alreadyNormalized) {
      // Subsequent normalizations: only reconcile between current URL search and ctx.query
      // (do not re-apply defaults), keeping ctx.query as higher priority when requested
      finalQuery = opts.requestOptionsOverridesURLSearchParams
        ? this.mergeQueries({}, reqURL.search, c.query)
        : this.mergeQueries({}, c.query, reqURL.search)
    } else {
      // First normalization: apply defaults and base URL
      finalQuery = opts.requestOptionsOverridesURLSearchParams
        ? this.mergeQueries(baseURL?.search || '', reqURL.search, c.query)
        : this.mergeQueries(baseURL?.search || '', c.query, reqURL.search)
      ;(c as any)[Fexios.NORMALIZED_SYMBOL] = true
    }

    // keep query in ctx.query; strip search part from url
    ;(c as any).query = finalQuery
    const urlNoSearch = new URL(reqURL)
    urlNoSearch.search = ''
    c.url = urlNoSearch.toString()
    return c
  }

  async emit<E extends FexiosLifecycleEvents, C = FexiosLifecycleEventMap[E]>(
    event: E,
    ctx: C,
    _internal: Partial<{
      /** should adjust ctx.url/ctx.query/ctx.headers after the hook */
      shouldAdjustRequestParams: boolean
      /** should handle the short circuit response after the hook */
      shouldHandleShortCircuitResponse: boolean
      /** whether to run pre-adjustment (before hooks run) */
      preAdjust: boolean
      /** control query merge priority without relying on event name */
      requestOptionsOverridesURLSearchParams: boolean
      /** pre-adjust priority override */
      preRequestOptionsOverridesURLSearchParams: boolean
      /** post-adjust priority override */
      postRequestOptionsOverridesURLSearchParams: boolean
    }> = {}
  ) {
    const hooks = this.hooks.filter((hook) => hook.event === event)

    // Pre-adjust request params BEFORE running hooks so that interceptors receive normalized ctx
    if (_internal?.shouldAdjustRequestParams && _internal?.preAdjust) {
      try {
        ctx = this.normalizeContext(ctx as unknown as FexiosContext, {
          requestOptionsOverridesURLSearchParams:
            _internal.preRequestOptionsOverridesURLSearchParams,
        }) as unknown as C
      } catch (e) {
        // swallow URL rebuild errors here; they'll surface later if invalid
      }
    }
    try {
      let index = 0
      for (const hook of hooks) {
        const hookName = `${event}#${hook.action.name || `anonymous#${index}`}`

        // Set a symbol to check if the hook overrides the original context
        const symbol = Symbol('FEXIOS_HOOK_CONTEXT')
        ;(ctx as any)[symbol] = symbol

        // snapshot before running hook for change detection
        const prevUrl = (ctx as any as FexiosContext).url
        let prevQueryStr = ''
        try {
          const prevPlain = this.mergeQueries(
            {},
            (ctx as any as FexiosContext).query || {}
          )
          prevQueryStr = JSON.stringify(prevPlain)
        } catch (_) {}

        let hookResult = (await hook.action.call(this, ctx)) as Awaited<
          C | void | false | Response
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
        // Short-circuit with a raw Response returned by hook
        else if (hookResult instanceof Response) {
          const rawResponse = hookResult
          const finalCtx: any = { ...(ctx as any), rawResponse }
          const response = await createFexiosResponse(
            rawResponse,
            (ctx as any as FexiosContext).responseType,
            (progress, buffer) => {
              ;(ctx as any as FexiosContext).onProgress?.(progress, buffer)
            }
          )
          finalCtx.response = response
          finalCtx.data = response.data
          finalCtx.headers = response.headers
          if (event !== 'afterResponse') {
            const after = (await this.emit('afterResponse', finalCtx)) as any
            ;(after as any)[Fexios.FINAL_SYMBOL] = true
            return after
          } else {
            ;(finalCtx as any)[Fexios.FINAL_SYMBOL] = true
            return finalCtx
          }
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

        // Adjust request params when needed (url <-> query sync, etc.)
        if (_internal?.shouldAdjustRequestParams) {
          try {
            const baseUrlString =
              (ctx as any as FexiosContext).baseURL ||
              globalThis.location?.href ||
              'http://localhost'
            const reqURL = new URL(
              (ctx as any as FexiosContext).url.toString(),
              baseUrlString
            )

            // Use pre-hook normalized snapshot as baseline (reflecting baseURL/query/requestURL before hook)
            let baseline: Record<string, any> = {}
            if (prevQueryStr) {
              try {
                baseline = JSON.parse(prevQueryStr)
              } catch {}
            }

            const hookRecord = ((ctx as any as FexiosContext).query ||
              {}) as Record<string, any>

            // Merge priority (post-hook): ctx.query > ctx.url (post-hook) > baseline (pre-hook effective)
            const mergedPlain = this.mergeQueries(
              baseline,
              reqURL.search,
              hookRecord
            )
            ;(ctx as any as FexiosContext).query = mergedPlain as any

            // strip search from url and keep hash
            const urlNoSearch = new URL(reqURL)
            urlNoSearch.search = ''
            ;(ctx as any as FexiosContext).url = urlNoSearch.toString()
          } catch (e) {
            // swallow URL rebuild errors here; they'll surface later in actual fetch if invalid
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

  on<E extends FexiosLifecycleEvents, C = FexiosLifecycleEventMap[E]>(
    event: E,
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

  off<E extends FexiosLifecycleEvents>(
    event: E,
    action: FexiosHook<FexiosLifecycleEventMap[E]>
  ): this
  off(event: '*' | null, action: FexiosHook<any>): this
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
  ): FexiosInterceptor<T> {
    return {
      handlers: () =>
        this.hooks
          .filter((hook) => hook.event === event)
          .map((hook) => hook.action),
      use: (hook, prepend = false) => {
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

  private createMethodShortcut<T extends Lowercase<FexiosMethods>>(method: T) {
    Reflect.defineProperty(this, method, {
      get: () => {
        return (
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
        }
      },
    })
    return this
  }

  extends(configs: Partial<FexiosConfigs>) {
    const fexios = new Fexios(deepMerge(this.baseConfigs, configs))
    // clone hooks
    fexios.hooks = [...this.hooks]
    // clone and reinstall plugins
    fexios._plugins = new Map(this._plugins)
    fexios._plugins.forEach(async (plugin) => {
      await fexios.plugin(plugin)
    })
    return fexios
  }

  readonly create = Fexios.create
  static create(configs?: Partial<FexiosConfigs>) {
    return new Fexios(configs)
  }

  private _plugins = new Map<string, FexiosPlugin>()
  async plugin(plugin: FexiosPlugin) {
    if (
      typeof plugin?.name === 'string' &&
      typeof plugin?.install === 'function'
    ) {
      if (this._plugins.has(plugin.name)) {
        // already installed
        return this
      }
      const fx = await plugin.install(this)
      this._plugins.set(plugin.name, plugin)
      if (fx instanceof Fexios) {
        return fx
      }
    }
    return this
  }

  // 版本弃子们.jpg
  /** @deprecated Use `import { checkIsPlainObject } from 'fexios/utils'` instead */
  readonly checkIsPlainObject = isPlainObject

  /** @deprecated Use `mergeQueries` instead */
  readonly mergeQuery = this.mergeQueries
}

// 魔术技巧
export interface Fexios {
  <T = any>(
    url: string | URL,
    options?: Partial<FexiosRequestOptions>
  ): Promise<FexiosFinalContext<T>>
  <T = any>(
    options: Partial<FexiosRequestOptions> & { url: string | URL }
  ): Promise<FexiosFinalContext<T>>
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

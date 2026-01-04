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
} from './types.js'
import {
  createFexiosResponse,
  FexiosError,
  FexiosErrorCodes,
  FexiosHeaderBuilder,
  FexiosQueryBuilder,
} from './models/index.js'
import { deepMerge, isPlainObject, CallableInstance } from './utils/index.js'

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
    timeout: 0,
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
    let ctx: FexiosContext = (options || {}) as FexiosContext

    if (typeof urlOrOptions === 'string' || urlOrOptions instanceof URL) {
      ctx.url = urlOrOptions.toString()
    } else if (typeof urlOrOptions === 'object') {
      ctx = urlOrOptions as FexiosContext
    }

    ctx = await this.emit('beforeInit', ctx)
    if ((ctx as any)[Fexios.FINAL_SYMBOL]) return ctx as any

    // first normalization
    // Only apply defaults once after beforeInit
    ctx = this.applyDefaults(ctx)

    // method/body check
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

    // beforeRequest
    ctx = await this.emit('beforeRequest', ctx)
    if ((ctx as any)[Fexios.FINAL_SYMBOL]) return ctx as any

    // resolve body & auto Content-Type
    let body: string | FormData | URLSearchParams | Blob | undefined
    const headerAutoPatch: Record<string, unknown> = {}
    if (typeof ctx.body !== 'undefined' && ctx.body !== null) {
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

    // if user didn't explicitly give content-type, auto patch it based on body
    const optionsHeaders = FexiosHeaderBuilder.makeHeaders(ctx.headers || {})
    if (!optionsHeaders.get('content-type') && body) {
      if (body instanceof FormData || body instanceof URLSearchParams) {
        // let browser set boundary automatically
        headerAutoPatch['content-type'] = null
      } else if (typeof body === 'string' && typeof ctx.body === 'object') {
        headerAutoPatch['content-type'] = 'application/json'
      } else if (body instanceof Blob) {
        headerAutoPatch['content-type'] =
          body.type || 'application/octet-stream'
      }
    }
    ctx.body = body

    // afterBodyTransformed
    ctx = await this.emit('afterBodyTransformed', ctx)
    if ((ctx as any)[Fexios.FINAL_SYMBOL]) return ctx as any

    // build Request
    const abortController =
      (ctx.abortController as AbortController | undefined) ??
      (globalThis.AbortController ? new AbortController() : undefined)

    // 此时 ctx.url 应该已经是完整 URL (由 applyDefaults 保证)
    // 但如果在 hooks 中被修改为相对路径，我们需要再次尝试 resolve
    const fallback = globalThis.location?.href || 'http://localhost'
    // Resolve base URL to absolute
    const baseForRequest = new URL(
      ctx.baseURL || this.baseConfigs.baseURL || fallback,
      fallback
    )
    const urlObjForRequest = new URL(ctx.url, baseForRequest)

    // 合并 ctx.query 到 URL searchParams (ctx.query 优先)
    const finalURLForRequest = FexiosQueryBuilder.makeURL(
      urlObjForRequest,
      (ctx as any as FexiosContext).query,
      urlObjForRequest.hash // 保留 hash
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

    // beforeActualFetch
    ctx = await this.emit('beforeActualFetch', ctx)
    if ((ctx as any)[Fexios.FINAL_SYMBOL]) return ctx as any

    const timeout = ctx.timeout ?? this.baseConfigs.timeout ?? 60 * 1000
    const shouldThrow = ctx.shouldThrow ?? this.baseConfigs.shouldThrow

    // WebSocket / SSE are moved to plugins in the next major version.
    // Keep a helpful runtime error for legacy usage.
    if (ctx.url.startsWith('ws') || (ctx.responseType as any) === 'ws') {
      throw new FexiosError(
        FexiosErrorCodes.FEATURE_MOVED_TO_PLUGIN,
        `WebSocket support has been moved to plugins. Use "fexios/plugins" and call fx.ws() instead.`,
        ctx
      )
    }
    if ((ctx.responseType as any) === 'stream') {
      throw new FexiosError(
        FexiosErrorCodes.FEATURE_MOVED_TO_PLUGIN,
        `SSE support has been moved to plugins. Use "fexios/plugins" and call fx.sse() instead.`,
        ctx
      )
    }

    // —— fetch + 超时控制 —— //
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      if (abortController) {
        timer =
          timeout > 0
            ? setTimeout(() => {
                abortController.abort()
              }, timeout)
            : undefined
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
          options?.onProgress?.(progress, buffer)
        },
        shouldThrow,
        timeout
      )
      // Ensure ctx.rawResponse always points to ctx.response.rawResponse (the unread original Response).
      ctx.rawResponse = ctx.response.rawResponse

      Object.defineProperties(ctx, {
        url: { get: () => ctx.rawResponse?.url || finalURLForRequest },
        data: { get: () => ctx.response!.data },
        headers: { get: () => ctx.rawResponse!.headers },
        responseType: { get: () => ctx.response!.responseType },
      })

      return this.emit('afterResponse', ctx) as any
    } catch (error) {
      if (timer) clearTimeout(timer)
      throw error
    }
  }

  mergeQueries = FexiosQueryBuilder.mergeQueries
  mergeHeaders = FexiosHeaderBuilder.mergeHeaders

  private applyDefaults(ctx: FexiosContext): FexiosContext {
    const c = ctx as FexiosContext

    // 0. Inherit customEnv from baseConfigs
    // Priority: ctx.customEnv > baseConfigs.customEnv
    if ('customEnv' in this.baseConfigs) {
      c.customEnv = deepMerge(
        {}, // ensure we don't mutate baseConfigs
        (this.baseConfigs as any).customEnv,
        c.customEnv
      )
    }

    const fallback = globalThis.location?.href || 'http://localhost'

    // 1. Resolve Base URL
    // Priority: ctx.baseURL > defaults.baseURL > fallback
    const effectiveBase = c.baseURL || this.baseConfigs.baseURL || fallback

    const baseObj = new URL(effectiveBase, fallback)

    // 2. Resolve Full URL & Merge Base Search Params
    // new URL(path, base) will drop base's search params, so we need to merge them manually
    const reqURL = new URL(c.url.toString(), baseObj)

    const baseSearchParams = FexiosQueryBuilder.toQueryRecord(
      baseObj.searchParams
    )
    const reqSearchParams = FexiosQueryBuilder.toQueryRecord(
      reqURL.searchParams
    )

    // Priority: ctx.url (reqSearchParams) > base (baseSearchParams)
    const mergedSearchParams = FexiosQueryBuilder.mergeQueries(
      baseSearchParams,
      reqSearchParams
    )

    // Write back merged search params
    reqURL.search =
      FexiosQueryBuilder.makeSearchParams(mergedSearchParams).toString()

    // Update ctx.url to full URL
    // We keep ctx.baseURL for potential later usage (e.g. if hook changes url to relative)
    c.url = reqURL.toString()
    // delete c.baseURL

    // 3. Merge ctx.query
    // Priority: ctx.query > defaults.query
    // Note: ctx.query is NOT merged with ctx.url search params here
    const mergedQuery = FexiosQueryBuilder.mergeQueries(
      this.baseConfigs.query,
      c.query
    )

    // Restore null values from ctx.query to ensure they can delete params from URL later
    if (c.query) {
      this.restoreNulls(mergedQuery, c.query)
    }

    ;(c as any).query = mergedQuery

    return c
  }

  private restoreNulls(target: any, source: any) {
    if (!source || typeof source !== 'object') return
    for (const [k, v] of Object.entries(source)) {
      if (v === null) {
        target[k] = null
      } else if (isPlainObject(v)) {
        if (!target[k] || typeof target[k] !== 'object') {
          target[k] = {}
        }
        this.restoreNulls(target[k], v)
      }
    }
  }

  async emit<E extends FexiosLifecycleEvents, C = FexiosLifecycleEventMap[E]>(
    event: E,
    ctx: C,
    opts: { shouldHandleShortCircuitResponse?: boolean } = {
      shouldHandleShortCircuitResponse: true,
    }
  ): Promise<C> {
    const hooks = this.hooks.filter((h) => h.event === event)
    if (hooks.length === 0) return ctx

    const shortCircuit = async (baseCtx: any, raw: Response): Promise<any> => {
      const finalCtx: any = { ...baseCtx, rawResponse: raw }
      const response = await createFexiosResponse(
        raw,
        (baseCtx as FexiosContext).responseType,
        (progress, buffer) =>
          (baseCtx as FexiosContext).onProgress?.(progress, buffer),
        (baseCtx as FexiosContext).shouldThrow ?? this.baseConfigs.shouldThrow,
        (baseCtx as FexiosContext).timeout ??
          this.baseConfigs.timeout ??
          60 * 1000
      )
      finalCtx.response = response
      // Keep the same invariant as normal request:
      // ctx.rawResponse === ctx.response.rawResponse (unread original Response).
      finalCtx.rawResponse = response.rawResponse
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

    for (let i = 0; i < hooks.length; i++) {
      const hook = hooks[i]
      const hookName = `${String(event)}#${
        hook.action.name || `anonymous#${i}`
      }`

      const marker = Symbol('FEXIOS_HOOK_CTX_MARK')
      try {
        ;(ctx as any)[marker] = marker
      } catch {}

      const result = await hook.action.call(this, ctx as any)

      try {
        delete (ctx as any)[marker]
      } catch {}

      if (result === false) {
        throw new FexiosError(
          FexiosErrorCodes.ABORTED_BY_HOOK,
          `Request aborted by hook "${hookName}"`,
          ctx as unknown as FexiosContext
        )
      }

      if (result instanceof Response) {
        if (opts.shouldHandleShortCircuitResponse !== false) {
          return shortCircuit(ctx, result)
        }
        ;(ctx as any).rawResponse = result
      } else if (
        result &&
        typeof result === 'object' &&
        (result as any)[marker] === marker
      ) {
        ctx = result as C
      } else {
        // no-op
      }
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
    return () => {
      this.uninstall(plugin)
    }
  }
  uninstall(plugin: FexiosPlugin | string) {
    if (typeof plugin === 'string') {
      plugin = this._plugins.get(plugin)!
    }
    if (plugin) {
      plugin?.uninstall?.(this)
      this._plugins.delete(plugin.name)
    }
  }

  // 版本弃子们.jpg
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

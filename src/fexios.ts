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
  createFexiosWebSocketResponse,
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
    ctx = this.normalizeContext(ctx)

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

    // WebSocket 分支
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
      return this.emit('afterResponse', finalCtx) as Promise<
        FexiosFinalContext<T>
      >
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
        }
      )

      Object.defineProperties(ctx, {
        url: { get: () => rawResponse?.url || finalURLForRequest },
        data: { get: () => ctx.response!.data },
        headers: { get: () => rawResponse!.headers },
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

  private normalizeContext(ctx: FexiosContext): FexiosContext {
    const c = ctx as FexiosContext

    const fallback = globalThis.location?.href || 'http://localhost'
    const defaultsBaseURL = new URL(
      this.baseConfigs.baseURL || fallback,
      fallback
    )

    // 解析当前请求 URL（相对 ctx.baseURL 或 defaults.baseURL）
    const baseForResolve = new URL(
      (c.baseURL || this.baseConfigs.baseURL || fallback) as string,
      fallback
    )
    const reqURL = new URL(c.url.toString(), baseForResolve)

    // 标记首次归一化（首次引入 defaults 层）
    const firstTime = !Boolean((c as any)[Fexios.NORMALIZED_SYMBOL])
    if (firstTime) (c as any)[Fexios.NORMALIZED_SYMBOL] = true

    // ---- 合并 query ----
    // 优先级：ctx.query > ctx.url.searchParams > defaults.query > defaults.baseURL.searchParams
    const merged = firstTime
      ? this.mergeQueries(
          defaultsBaseURL.search || '',
          this.baseConfigs.query,
          reqURL.search,
          c.query
        )
      : // 后续归一化：仅对齐“当前 URL search 与 ctx.query”，仍保持 ctx 优先
        this.mergeQueries({}, reqURL.search, c.query)

    ;(c as any).query = merged as any

    // ---- 清理 URL：仅保留 origin + pathname + hash ----
    // 删除 search，但保留 hash（如果存在）
    const urlClean = new URL(reqURL)
    urlClean.search = ''
    c.baseURL = new URL(
      c.baseURL || this.baseConfigs.baseURL || fallback,
      fallback
    ).origin
    c.url = `${urlClean.origin}${urlClean.pathname}${urlClean.hash || ''}`

    return c
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
          (baseCtx as FexiosContext).onProgress?.(progress, buffer)
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

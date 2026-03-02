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
import { deepMerge, CallableInstance } from './utils/index.js'
import { attachLegacyAliases, finalizeContext } from './internals/context.js'
import { executeHooks } from './internals/hooks.js'
import {
  applyDefaults,
  transformBody,
  buildFinalURL,
} from './internals/request-helpers.js'

/**
 * Fexios
 * @desc Fetch based HTTP client with similar API to axios for browser and Node.js
 */
export class Fexios extends CallableInstance<
  [
    string | URL | (Partial<FexiosRequestOptions> & { url: string | URL }),
    Partial<FexiosRequestOptions>?,
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
    const thisApp = this
    let reqInit: Partial<FexiosRequestOptions> = options || {}

    if (typeof urlOrOptions === 'string' || urlOrOptions instanceof URL) {
      reqInit = { ...(options || {}), url: urlOrOptions }
    } else if (typeof urlOrOptions === 'object') {
      reqInit = urlOrOptions as any
    }

    const {
      abortController: inputAbortController,
      customEnv,
      ...requestOnly
    } = reqInit as any

    let ctx: FexiosContext = {
      get app() {
        return thisApp
      },
      request: {
        ...(requestOnly as any),
        url: (reqInit.url as any)?.toString?.() ?? String(reqInit.url),
      } as any,
      runtime: {
        abortController: inputAbortController,
        customEnv,
      },
      response: undefined,
      rawResponse: undefined,
      // legacy fields are attached via defineProperty
      url: '',
      headers: {} as any,
      query: {} as any,
    } as any
    attachLegacyAliases(ctx)

    ctx = await this.emit('beforeInit', ctx)
    if ((ctx as any)[Fexios.FINAL_SYMBOL]) return ctx as any

    // Only apply defaults once after beforeInit
    // 0) runtime defaults (customEnv)
    if ('customEnv' in this.baseConfigs) {
      ctx.runtime.customEnv = deepMerge(
        {}, // ensure we don't mutate baseConfigs
        (this.baseConfigs as any).customEnv,
        ctx.runtime.customEnv
      )
    }

    // 1) request defaults
    ctx.request = applyDefaults(ctx.request as any, this.baseConfigs)

    // method/body check
    if (
      Fexios.METHODS_WITHOUT_BODY.includes(
        (ctx.request.method as any)?.toLocaleLowerCase?.() as FexiosMethods
      ) &&
      (ctx.request as any).body
    ) {
      throw new FexiosError(
        FexiosErrorCodes.BODY_NOT_ALLOWED,
        `Request method "${ctx.request.method}" does not allow body`
      )
    }

    // beforeRequest
    ctx = await this.emit('beforeRequest', ctx)
    if ((ctx as any)[Fexios.FINAL_SYMBOL]) return ctx as any

    // resolve body & auto Content-Type
    const { body, headerAutoPatch } = transformBody(
      ctx.request as any,
      this.mergeHeaders
    )
    ;(ctx.request as any).body = body

    // afterBodyTransformed
    ctx = await this.emit('afterBodyTransformed', ctx)
    if ((ctx as any)[Fexios.FINAL_SYMBOL]) return ctx as any

    // build Request
    const abortController =
      (ctx.runtime.abortController as AbortController | undefined) ??
      (globalThis.AbortController ? new AbortController() : undefined)

    const finalURLForRequest = buildFinalURL(ctx, this.baseConfigs)

    const rawRequest = new Request(finalURLForRequest, {
      method: (ctx.request as any).method || 'GET',
      credentials: (ctx.request as any).credentials,
      cache: (ctx.request as any).cache,
      mode: (ctx.request as any).mode,
      headers: FexiosHeaderBuilder.mergeHeaders(
        this.baseConfigs.headers,
        (ctx.request as any).headers || {},
        headerAutoPatch
      ),
      body: (ctx.request as any).body as any,
      signal: abortController?.signal,
    })
    ctx.request.rawRequest = rawRequest

    // beforeActualFetch
    ctx = await this.emit('beforeActualFetch', ctx)
    if ((ctx as any)[Fexios.FINAL_SYMBOL]) return ctx as any

    const timeout =
      (ctx.request as any).timeout ?? this.baseConfigs.timeout ?? 60 * 1000
    const shouldThrow =
      (ctx.request as any).shouldThrow ?? this.baseConfigs.shouldThrow

    // WebSocket / SSE are moved to plugins in the next major version.
    // Keep a helpful runtime error for legacy usage.
    if (
      (ctx.request as any).url.startsWith('ws') ||
      ((ctx.request as any).responseType as any) === 'ws'
    ) {
      throw new FexiosError(
        FexiosErrorCodes.FEATURE_MOVED_TO_PLUGIN,
        `WebSocket support has been moved to plugins. Use "fexios/plugins" and call fx.ws() instead.`,
        ctx
      )
    }
    if (((ctx.request as any).responseType as any) === 'stream') {
      throw new FexiosError(
        FexiosErrorCodes.FEATURE_MOVED_TO_PLUGIN,
        `SSE support has been moved to plugins. Use "fexios/plugins" and call fx.sse() instead.`,
        ctx
      )
    }

    // —— fetch + timeout —— //
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

      const fetch =
        (ctx.request as any).fetch || this.baseConfigs.fetch || globalThis.fetch
      const rawResponse = await fetch(ctx.request.rawRequest!).catch(
        (err: any) => {
          if (timer) clearTimeout(timer)
          if (abortController?.signal.aborted) {
            throw new FexiosError(
              FexiosErrorCodes.TIMEOUT,
              `Request timed out after ${timeout}ms`,
              ctx
            )
          }
          throw new FexiosError(
            FexiosErrorCodes.NETWORK_ERROR,
            err.message,
            ctx
          )
        }
      )

      if (timer) clearTimeout(timer)

      ctx.rawResponse = rawResponse
      await this.emit('afterRawResponse', ctx)
      if ((ctx as any)[Fexios.FINAL_SYMBOL]) return ctx as any

      ctx.response = await createFexiosResponse(
        rawResponse,
        (ctx.request as any).responseType,
        shouldThrow,
        timeout
      )
      // Ensure ctx.rawResponse always points to ctx.response.rawResponse (the unread original Response).
      ctx.rawResponse = ctx.response.rawResponse

      finalizeContext(ctx, finalURLForRequest)

      return this.emit('afterResponse', ctx) as any
    } catch (error) {
      if (timer) clearTimeout(timer)
      throw error
    }
  }

  mergeQueries = FexiosQueryBuilder.mergeQueries
  mergeHeaders = FexiosHeaderBuilder.mergeHeaders

  async emit<E extends FexiosLifecycleEvents, C = FexiosLifecycleEventMap[E]>(
    event: E,
    ctx: C,
    opts: { shouldHandleShortCircuitResponse?: boolean } = {
      shouldHandleShortCircuitResponse: true,
    }
  ): Promise<C> {
    return executeHooks(
      this.hooks,
      this,
      event,
      ctx,
      Fexios.FINAL_SYMBOL,
      this.baseConfigs,
      this.emit.bind(this),
      opts
    )
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
  plugin(plugin: FexiosPlugin): Fexios {
    if (
      typeof plugin?.name === 'string' &&
      typeof plugin?.install === 'function'
    ) {
      if (this._plugins.has(plugin.name)) {
        // already installed
        return this
      }
      const fx = plugin.install(this)
      this._plugins.set(plugin.name, plugin)
      if (fx instanceof Fexios) {
        return fx
      }
    }
    return this
  }
  uninstall(plugin: FexiosPlugin | string) {
    if (typeof plugin === 'string') {
      plugin = this._plugins.get(plugin)!
    }
    if (plugin) {
      plugin?.uninstall?.(this)
      this._plugins.delete(plugin.name)
    }
    return this
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

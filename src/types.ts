import { Fexios } from './fexios.js'
import { FexiosResponse } from './models/response.js'

/**
 * Type definitions for Fexios
 */

export type AwaitAble<T = unknown> = Promise<T> | T

export type FetchLike = (
  input: Request | string | URL,
  init?: RequestInit
) => Promise<Response>

export interface FexiosConfigs {
  baseURL: string | URL
  timeout: number
  /**
   * Query parameters, its value can be:
   * - `null`      - to remove the item
   * - `undefined` - to keep the item as is
   */
  query: Record<string, any> | URLSearchParams
  headers: Record<string, string | string[]> | Headers
  credentials?: RequestInit['credentials']
  cache?: RequestInit['cache']
  mode?: RequestInit['mode']
  /**
   * Whether to throw FexiosResponseError for non-OK response.
   * @default
   * ```ts
   * (response) => !response.ok
   * ```
   */
  shouldThrow?: (response: FexiosResponse<any>) => boolean | void
  /**
   * Fexios will try its best to transform request body.
   *
   *
   * ### `"json"`
   * - If body is text-like, it will be parsed as JSON first. If parsing fails, it will be sent as is.
   * - If body is FormData or URLSearchParams, see `FexiosQueryBuilder.toQueryRecord` for conversion details.
   *
   * ### `"text"`
   * - Body always be sent as text.
   * - Even if body is not text-like, it will be converted to string using `String(body)`.
   *
   * ### `"form"`
   * - If body is FormData or URLSearchParams, it will be sent as is.
   * - Other transformations is NOT supported YET.
   *
   * ### `"blob"`
   * - If body is ArrayBuffer or TypedArray, it will be converted to Blob.
   * - If body is text-like, it will be converted to Blob using UTF-8 encoding.
   *
   * ### `"arrayBuffer"`
   * - If body is Blob or TypedArray, it will be converted to ArrayBuffer.
   * - If body is text-like, it will be converted to ArrayBuffer using UTF-8 encoding.
   *
   * ### `undefined`
   * This means auto-detect based on content-type header.
   * - `application/json` -> JSON
   * - `text/plain` -> Try to parse as JSON, if fails, Text
   * - `text/*`, `application/text`, `application/xml`, `application/javascript` -> Text
   * - `multipart/form-data`, `application/x-www-form-urlencoded` -> Form
   * - `image/*`, `video/*`, `audio/*`, `application/pdf` -> Blob
   * - Others -> Try to detect if it's probably text data, if yes, Text, otherwise ArrayBuffer
   * - For unknown content-type, if content-length is 0, Text will be assumed.
   * - Note: WebSocket / SSE are NOT handled by core. Use plugins instead.
   *
   * If transformation fails, ArrayBuffer / stream / FormData will be sent as is.
   */
  responseType?: 'json' | 'text' | 'form' | 'blob' | 'arrayBuffer'
  fetch?: FetchLike
}

export interface FexiosRequestOptions extends Omit<FexiosConfigs, 'headers'> {
  url?: string | URL
  method?: FexiosMethods
  /**
   * Request headers, its value can be:
   * - `null`      - to remove the header
   * - `undefined` - to keep the header as is
   */
  headers: Record<string, string | string[] | null | undefined> | Headers
  /**
   * Request body
   */
  body?: Record<string, any> | string | FormData | URLSearchParams
  /**
   * Custom environment variables, can be any value.
   * Useful for passing data between hooks.
   */
  customEnv?: any
  /**
   * AbortController for cancellation/timeout control.
   * @note
   * In v6, this will be moved to `ctx.runtime.abortController` in lifecycle hooks.
   */
  abortController?: AbortController
  /**
   * Progress callback for streaming responses.
   * @note
   * In v6, this will be moved to `ctx.runtime.onProgress` in lifecycle hooks.
   */
  onProgress?: (progress: number, buffer?: Uint8Array) => void
}

export type FexiosRequestContext = Omit<
  FexiosRequestOptions,
  'url' | 'abortController' | 'onProgress' | 'customEnv'
> & {
  /** Request URL, may be relative before normalization */
  url: string
  /**
   * Built Request instance that will be sent (after hooks & normalization).
   * Available from `beforeActualFetch` and later.
   */
  rawRequest?: Request
}

export type FexiosRuntimeContext = {
  abortController?: AbortController
  onProgress?: (progress: number, buffer?: Uint8Array) => void
  /**
   * Custom environment variables, can be any value.
   * Useful for passing data between hooks and plugins.
   */
  customEnv?: any
}

// Alias for response, make all context names more unified
export { FexiosResponse as FexiosResponseContext }

export interface FexiosContext<T = any> {
  /**
   * The current Fexios instance handling this request.
   * This is injected by core before any lifecycle hooks are executed.
   */
  readonly app: Fexios
  request: FexiosRequestContext
  runtime: FexiosRuntimeContext
  /**
   * Parsed response wrapper.
   * Available in `afterResponse` and in the final returned context.
   */
  response?: FexiosResponse<T>
  /**
   * Raw response (may be the original Response before parsing).
   * Available from `afterRawResponse` and later.
   * @note
   * In final context, `ctx.rawResponse === ctx.response.rawResponse` (unread original Response).
   */
  rawResponse?: Response

  /**
   * --- Legacy aliases (v5) ---
   * They are kept for easier migration and will be removed in a future major.
   */
  /** @deprecated Use `ctx.request.url` */
  url: string
  /** @deprecated Use `ctx.request.method` */
  method?: FexiosMethods
  /** @deprecated Use `ctx.request.headers` */
  headers: FexiosRequestOptions['headers']
  /** @deprecated Use `ctx.request.query` */
  query: FexiosRequestOptions['query']
  /** @deprecated Use `ctx.request.body` */
  body?: FexiosRequestOptions['body']
  /** @deprecated Use `ctx.runtime.abortController` */
  abortController?: AbortController
  /** @deprecated Use `ctx.runtime.onProgress` */
  onProgress?: (progress: number, buffer?: Uint8Array) => void
  /** @deprecated Use `ctx.runtime.customEnv` */
  customEnv?: any
  /** @deprecated Use `ctx.request.rawRequest` */
  rawRequest?: Request
  /**
   * Resolved response body (shortcut, usually only meaningful after response is ready)
   */
  data?: T
}

export type FexiosFinalContext<T = any> = Omit<
  Required<FexiosContext<T>>,
  'headers' | 'url' | 'responseType' | 'data' | 'rawRequest' | 'rawResponse' // redefined below as readonly shortcut
> & {
  /** Shortcut: response raw Request */
  readonly rawRequest: Request
  /** Shortcut: response raw Response (unread original Response) */
  readonly rawResponse: Response
  /** Response Headers */
  readonly headers: Headers
  /**
   * Resolved response body
   * @note
   * This is a read-only property,
   * if you want to completely replace the ctx.data,
   * you should return Response in `afterResponse` hook.
   */
  readonly data: T
  /**
   * Response type of data
   * If not set in request options, it will be guessed based on content-type header.
   * May be different from required responseType in request options.
   */
  readonly responseType: NonNullable<FexiosConfigs['responseType']>
  /** Response URL */
  readonly url: string
}

export type FexiosHook<C = unknown> = (
  context: C
) => AwaitAble<C | void | false | Response>

export interface FexiosHookStore {
  event: FexiosLifecycleEvents
  action: FexiosHook
}

export type FexiosLifecycleEvents = keyof FexiosLifecycleEventMap

export interface FexiosLifecycleEventMap {
  beforeInit: Omit<
    FexiosContext,
    'rawRequest' | 'rawResponse' | 'response' | 'data'
  >
  beforeRequest: Required<
    Omit<FexiosContext, 'rawRequest' | 'rawResponse' | 'response' | 'data'>
  >
  afterBodyTransformed: Required<
    Omit<FexiosContext, 'rawRequest' | 'rawResponse' | 'response' | 'data'>
  >
  beforeActualFetch: Required<
    Omit<FexiosContext, 'rawResponse' | 'response' | 'data'>
  >
  afterRawResponse: Required<Omit<FexiosContext, 'response' | 'data'>>
  afterResponse: FexiosFinalContext
}

export interface FexiosInterceptor<E extends FexiosLifecycleEvents> {
  handlers: () => FexiosHookHandler<E>[]
  use: (hook: FexiosHookHandler<E>, prepend?: boolean) => any
  clear: () => void
}

export interface FexiosInterceptors {
  request: FexiosInterceptor<'beforeRequest'>
  response: FexiosInterceptor<'afterResponse'>
}

// Util type for create fexios hooks
// const onBeforeRequest: FexiosHookHandler<'beforeRequest'> = (ctx) => {...}
export type FexiosHookHandler<E extends FexiosLifecycleEvents> = FexiosHook<
  FexiosLifecycleEventMap[E]
> extends (ctx: FexiosLifecycleEventMap[E]) => any
  ? (ctx: FexiosLifecycleEventMap[E]) => any
  : never

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

// Forward declaration for circular dependency
export interface IFexiosResponse<T = any>
  extends Pick<
    Response,
    'ok' | 'status' | 'statusText' | 'headers' | 'url' | 'redirected'
  > {
  readonly rawResponse: Response
  readonly data: T
  readonly responseType: FexiosConfigs['responseType']
}

export type FexiosPlugin = {
  name: string
  install: (fx: Fexios) => Fexios | void
  uninstall?: (fx: Fexios) => void
}

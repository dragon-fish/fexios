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
  abortController?: AbortController
  onProgress?: (progress: number, buffer?: Uint8Array) => void
  /**
   * Custom environment variables, can be any value.
   * Useful for passing data between hooks.
   */
  customEnv?: any
}

export interface FexiosContext<T = any> extends FexiosRequestOptions {
  url: string
  rawRequest?: Request
  rawResponse?: Response
  response?: FexiosResponse
  /** Resolved response body */
  data?: T
}

export type FexiosFinalContext<T = any> = Omit<
  Required<FexiosContext<T>>,
  | 'onProgress'
  | 'abortController'
  | 'headers'
  | 'responseType'
  | 'url'
  | 'query'
  | 'data'
> & {
  /** Response Headers */
  readonly headers: Headers
  /**
   * Resolved response body
   * @note
   * This is a read-only property,
   * if you want to completely replace the ctx.data,
   * you should return Response in `afterResponse` hook.
   * @example
   * ```
   * // DO THIS √
   * fx.on('afterResponse', (ctx) => {
   *   return Response.json({ newData: 'new data' }, { status: 200 })
   * })
   * // DON'T DO THIS ×
   * fx.on('afterResponse', (ctx) => {
   *   ctx.data = { newData: 'new data' } // error!
   *   return ctx
   * })
   * ```
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
  afterResponse: FexiosFinalContext
}

export interface FexiosInterceptor<
  E extends FexiosLifecycleEvents,
  C = FexiosLifecycleEventMap[E]
> {
  handlers: () => FexiosHook[]
  use: (hook: FexiosHook<C>, prepend?: boolean) => any
  clear: () => void
}

export interface FexiosInterceptors {
  request: FexiosInterceptor<'beforeRequest'>
  response: FexiosInterceptor<'afterResponse'>
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
  install: (fx: Fexios) => Fexios | Promise<Fexios> | void
  uninstall?: (fx: Fexios) => void
}

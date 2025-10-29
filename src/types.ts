import { Fexios } from './fexios.js'

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
   * In context, query value can be:
   * - `null`      - to remove the item
   * - `undefined` - to keep the item as is
   */
  query: Record<string, any> | URLSearchParams
  headers: Record<string, string | string[]> | Headers
  credentials?: RequestInit['credentials']
  cache?: RequestInit['cache']
  mode?: RequestInit['mode']
  responseType?: 'json' | 'blob' | 'text' | 'stream' | 'arrayBuffer'
  fetch?: FetchLike
}

export interface FexiosRequestOptions extends Omit<FexiosConfigs, 'headers'> {
  url?: string | URL
  method?: FexiosMethods
  /**
   * In context, header value can be:
   * - `null`      - to remove the header
   * - `undefined` - to keep the header as is
   */
  headers: Record<string, string | string[] | null | undefined> | Headers
  body?: Record<string, any> | string | FormData | URLSearchParams
  abortController?: AbortController
  onProgress?: (progress: number, buffer?: Uint8Array) => void
}

export interface FexiosContext<T = any> extends FexiosRequestOptions {
  url: string
  rawRequest?: Request
  rawResponse?: Response
  response?: IFexiosResponse
  data?: T
}

export type FexiosFinalContext<T = any> = Required<FexiosContext<T>>

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
export interface IFexiosResponse<T = any> {
  ok: boolean
  status: number
  statusText: string
  headers: Headers
  rawResponse: Response
  data: T
}

export type FexiosPlugin = (app: Fexios) => void

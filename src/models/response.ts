import type {
  FexiosConfigs,
  IFexiosResponse as IFexiosResponse,
} from '../types.js'
import { FexiosError, FexiosErrorCodes, FexiosResponseError } from './errors.js'

/**
 * Fexios response wrapper class
 * @param data Transformed response body
 * @param responseType Guessed response type
 */
export class FexiosResponse<T = unknown> implements IFexiosResponse<T> {
  constructor(
    readonly rawResponse: IFexiosResponse['rawResponse'],
    readonly data: T,
    readonly responseType: IFexiosResponse['responseType']
  ) {
    ;['ok', 'status', 'statusText', 'headers', 'url', 'redirected'].forEach(
      (key) => {
        Reflect.defineProperty(this, key, {
          get: () => (rawResponse as any)[key],
        })
      }
    )
  }
  readonly ok!: boolean
  readonly status!: number
  readonly statusText!: string
  readonly headers!: Headers
  readonly url!: string
  readonly redirected!: boolean
}

const guessFexiosResponseType = (
  contentType: string
): IFexiosResponse['responseType'] => {
  if (!contentType) return undefined
  if (contentType.includes('application/json') || contentType.endsWith('+json'))
    return 'json'
  if (contentType.startsWith('text/')) return 'text'
  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  )
    return 'form'
  if (
    /^image\//.test(contentType) ||
    /^video\//.test(contentType) ||
    /^audio\//.test(contentType) ||
    contentType.includes('application/pdf')
  )
    return 'blob'
  if (
    contentType.includes('application/octet-stream') ||
    contentType.includes('application/zip') ||
    contentType.includes('application/x-tar') ||
    contentType.includes('application/x-7z-compressed') ||
    contentType.includes('application/x-gzip')
  )
    return 'arrayBuffer'
  return undefined
}

/**
 * Resolve response body based on content type and expected type
 * @param expectedType `undefined` means auto-detect based on content-type header. And also try JSON.stringify if it's a string.
 */
export async function createFexiosResponse<T = any>(
  rawResponse: Response,
  expectedType?: FexiosConfigs['responseType'],
  shouldThrow?: (response: FexiosResponse<any>) => boolean | void,
  timeout?: number
): Promise<FexiosResponse<T>> {
  /**
   * IMPORTANT:
   * - We want to expose the original `rawResponse` to user as an unread Response.
   * - But Fexios still needs to decode body to produce `data`.
   * So we read from a clone and keep the original response unconsumed.
   */
  const decodeResponse = rawResponse.clone()
  const contentType =
    rawResponse.headers.get('content-type')?.toLowerCase() ?? ''

  // Check for upgrade headers for websocket / SSE
  const upgrade = rawResponse.headers.get('upgrade')?.toLowerCase()
  const connection = rawResponse.headers.get('connection')?.toLowerCase()

  // ws/sse are removed from core (moved to plugins). Still detect legacy usage & guide users.
  if ((expectedType as any) === 'ws' || (expectedType as any) === 'stream') {
    throw new FexiosError(
      FexiosErrorCodes.FEATURE_MOVED_TO_PLUGIN,
      `responseType "${String(
        expectedType
      )}" has been moved to plugins. Use "fexios/plugins" (fx.plugin(pluginWebSocket) / fx.plugin(pluginSSE)) and call fx.ws()/fx.sse() instead.`
    )
  }
  if (upgrade === 'websocket' && connection === 'upgrade') {
    throw new FexiosError(
      FexiosErrorCodes.FEATURE_MOVED_TO_PLUGIN,
      `WebSocket upgrade response detected. WebSocket support has been moved to plugins. Please use "fexios/plugins" and call fx.ws().`
    )
  }
  if (contentType.includes('text/event-stream')) {
    throw new FexiosError(
      FexiosErrorCodes.FEATURE_MOVED_TO_PLUGIN,
      `SSE (text/event-stream) response detected. SSE support has been moved to plugins. Please use "fexios/plugins" and call fx.sse().`
    )
  }

  let resolvedType: IFexiosResponse['responseType'] =
    expectedType ?? guessFexiosResponseType(contentType) ?? 'text'

  // Note: core no longer auto-detects websocket/sse here.

  let data: any

  try {
    if (resolvedType === 'form') {
      // Resolve form data by fetch itself (no progress support)
      data = await decodeResponse.formData()
    } else if (resolvedType === 'arrayBuffer') {
      data = await decodeResponse.arrayBuffer()
    } else if (resolvedType === 'blob') {
      data = await decodeResponse.blob()
    } else if (resolvedType === 'json') {
      const text = await decodeResponse.text()
      data = text ? JSON.parse(text) : null
    } else if (resolvedType === 'text') {
      const text = await decodeResponse.text()
      if (!expectedType) {
        const trimmed = text.trim()
        if (
          (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))
        ) {
          try {
            data = JSON.parse(trimmed)
            resolvedType = 'json'
          } catch {
            data = text
          }
        } else {
          data = text
        }
      } else {
        data = text
      }
    } else {
      // Fallback or unknown type, return Uint8Array as implied by original 'else { data = bytes }'
      const ab = await decodeResponse.arrayBuffer()
      data = new Uint8Array(ab)
    }
  } catch (e) {
    // if parsing fails, try to read as plain text as last resort
    if (!(e instanceof Error)) throw e
    try {
      const t = await decodeResponse.text()
      data = t
      resolvedType = 'text'
    } catch {
      // if reading as plain text fails, throw the original error
      throw new FexiosError(
        FexiosErrorCodes.BODY_TRANSFORM_ERROR,
        `Failed to transform response body to ${resolvedType}`,
        undefined,
        { cause: e }
      )
    }
  }

  const response = new FexiosResponse<T>(
    rawResponse as any,
    data as T,
    resolvedType
  )

  const decision = shouldThrow?.(response)
  if (typeof decision === 'boolean' ? decision : !response.ok) {
    throw new FexiosResponseError(response.statusText, response)
  }

  return response
}

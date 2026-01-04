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

const concatUint8Arrays = (parts: Uint8Array[]) => {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

async function readBody(
  stream: ReadableStream<Uint8Array>,
  contentLength: number,
  onProgress?: (p: number, buf: Uint8Array) => void
) {
  const reader = stream.getReader()
  if (!reader) {
    throw new FexiosError(
      FexiosErrorCodes.NO_BODY_READER,
      'Failed to get ReadableStream from response body'
    )
  }

  const chunks: Uint8Array[] = []
  let received = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      if (onProgress && contentLength > 0)
        onProgress(received / contentLength, concatUint8Arrays(chunks))
    }
  } finally {
    reader.releaseLock?.()
  }

  const data = concatUint8Arrays(chunks)
  onProgress?.(1, data)
  return data
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
  onProgress?: (progress: number, buffer?: Uint8Array) => void,
  shouldThrow?: (response: FexiosResponse<any>) => boolean | void,
  timeout?: number
): Promise<FexiosResponse<T>> {
  /**
   * Clone the raw response to avoid mutating the original response.
   * This is important to ensure that the original response is not mutated by the response body reading process.
   */
  const clonedRawResponse = rawResponse.clone()
  const contentType =
    rawResponse.headers.get('content-type')?.toLowerCase() ?? ''
  const lenHeader = rawResponse.headers.get('content-length')
  const total = lenHeader ? Number(lenHeader) : 0

  // Check for upgrade headers for websocket/stream
  const upgrade = rawResponse.headers.get('upgrade')?.toLowerCase()
  const connection = rawResponse.headers.get('connection')?.toLowerCase()

  let resolvedType: IFexiosResponse['responseType'] =
    expectedType ?? guessFexiosResponseType(contentType) ?? 'text'

  // Auto-detect websocket/stream from headers if not explicitly set
  if (!expectedType) {
    if (upgrade === 'websocket' && connection === 'upgrade') {
      resolvedType = 'ws'
    } else if (contentType.includes('text/event-stream')) {
      resolvedType = 'stream'
    }
  }

  // special-cases that don't need body decoding
  if (resolvedType === 'stream') {
    const url = rawResponse.url || (rawResponse as any).url || ''
    const response = await createFexiosEventSourceResponse(
      url,
      clonedRawResponse,
      timeout
    )
    const decide = shouldThrow?.(response)
    if (typeof decide === 'boolean' ? decide : !response.ok) {
      throw new FexiosResponseError(response.statusText, response)
    }
    return response as FexiosResponse<T>
  }
  if (resolvedType === 'ws') {
    // fetch 不产生 WebSocket；这里只返回占位，交由上层处理
    const url = rawResponse.url || (rawResponse as any).url || ''
    const response = await createFexiosWebSocketResponse(
      url,
      clonedRawResponse,
      timeout
    )
    const decide = shouldThrow?.(response)
    if (typeof decide === 'boolean' ? decide : !response.ok) {
      throw new FexiosResponseError(response.statusText, response)
    }
    return response as FexiosResponse<T>
  }

  // decode helpers
  const charset = /\bcharset=([^;]+)/i.exec(contentType)?.[1]?.trim() || 'utf-8'
  const decoder = new TextDecoder(charset)

  let data: any

  try {
    if (resolvedType === 'form') {
      // Resolve form data by fetch itself (no progress support)
      data = await rawResponse.formData()
    } else {
      const bytes = await readBody(rawResponse.body!, total, onProgress)
      if (resolvedType === 'arrayBuffer') {
        data = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        )
      } else if (resolvedType === 'blob') {
        data = new Blob([bytes], {
          type: contentType || 'application/octet-stream',
        })
      } else if (resolvedType === 'text') {
        const text = decoder.decode(bytes)
        // auto-detect: if no explicit expected type and text looks like JSON, try to parse as JSON
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
      } else if (resolvedType === 'json') {
        const text = decoder.decode(bytes)
        data = text.length ? JSON.parse(text) : null
      } else {
        // theoretically should not reach here, unless user provides a expectedType out of scope
        data = bytes
      }
    }
  } catch (e) {
    // if parsing fails, try to read as plain text as last resort
    if (!(e instanceof Error)) throw e
    try {
      const t = await rawResponse.text()
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
    clonedRawResponse as any,
    data as T,
    resolvedType
  )

  const decision = shouldThrow?.(response)
  if (typeof decision === 'boolean' ? decision : !response.ok) {
    throw new FexiosResponseError(response.statusText, response)
  }

  return response
}

export async function createFexiosWebSocketResponse(
  url: string | URL,
  response?: Response,
  timeout?: number
) {
  const ws = new WebSocket(url.toString())
  const delay = timeout ?? 60000 // Default 60s timeout
  await new Promise<void>((resolve, reject) => {
    const timer =
      delay > 0
        ? setTimeout(() => {
            ws.close()
            reject(
              new FexiosError(
                FexiosErrorCodes.TIMEOUT,
                `WebSocket connection timed out after ${delay}ms`
              )
            )
          }, delay)
        : undefined

    let settled = false

    const cleanup = () => {
      clearTimeout(timer)
      ws.removeEventListener('open', onOpen)
      ws.removeEventListener('error', onError)
      ws.removeEventListener('close', onClose)
    }

    const onOpen = () => {
      if (!settled) {
        settled = true
        cleanup()
        resolve()
      }
    }

    const onError = (event: Event) => {
      if (!settled) {
        settled = true
        cleanup()
        reject(
          new FexiosError(
            FexiosErrorCodes.NETWORK_ERROR,
            `WebSocket connection failed`,
            undefined,
            { cause: event }
          )
        )
      }
    }

    const onClose = (event: CloseEvent) => {
      if (!settled) {
        settled = true
        cleanup()
        reject(
          new FexiosError(
            FexiosErrorCodes.NETWORK_ERROR,
            `WebSocket connection closed unexpectedly (code: ${event.code}, reason: ${event.reason})`,
            undefined,
            { cause: event }
          )
        )
      }
    }

    ws.addEventListener('open', onOpen)
    ws.addEventListener('error', onError)
    ws.addEventListener('close', onClose)
  })
  return new FexiosResponse<WebSocket>(response || new Response(null), ws, 'ws')
}

export async function createFexiosEventSourceResponse(
  url: string | URL,
  response?: Response,
  timeout?: number
) {
  const es = new EventSource(url.toString())
  const delay = timeout ?? 60000 // Default 60s timeout
  await new Promise<void>((resolve, reject) => {
    const timer =
      delay > 0
        ? setTimeout(() => {
            es.close()
            reject(
              new FexiosError(
                FexiosErrorCodes.TIMEOUT,
                `EventSource connection timed out after ${delay}ms`
              )
            )
          }, delay)
        : undefined

    let settled = false

    const cleanup = () => {
      clearTimeout(timer)
      es.removeEventListener('open', onOpen)
      es.removeEventListener('error', onError)
    }

    const onOpen = () => {
      if (!settled) {
        settled = true
        cleanup()
        resolve()
      }
    }

    const onError = (event: Event) => {
      if (!settled) {
        settled = true
        cleanup()
        reject(
          new FexiosError(
            FexiosErrorCodes.NETWORK_ERROR,
            `EventSource connection failed`,
            undefined,
            { cause: event }
          )
        )
      }
    }

    es.addEventListener('open', onOpen)
    es.addEventListener('error', onError)
  })
  return new FexiosResponse<EventSource>(
    response || new Response(null),
    es,
    'stream'
  )
}

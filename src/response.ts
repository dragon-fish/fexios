import type { FexiosConfigs, IFexiosResponse as IFexiosResponse } from './types'
import { FexiosError, FexiosErrorCodes, FexiosResponseError } from './errors'
import { checkIfTextData } from './utils'

/**
 * Fexios response wrapper class
 */
export class FexiosResponse<T = any> implements IFexiosResponse<T> {
  public ok: boolean
  public status: number
  public statusText: string
  public headers: Headers

  constructor(
    public rawResponse: Response,
    public data: T,
    overrides?: Partial<Omit<FexiosResponse<T>, 'rawResponse' | 'data'>>
  ) {
    this.ok = rawResponse.ok
    this.status = rawResponse.status
    this.statusText = rawResponse.statusText
    this.headers = rawResponse.headers
    Object.entries(overrides || {}).forEach(([key, value]) => {
      ;(this as any)[key] = value
    })
  }
}

/**
 * Resolve response body based on content type and expected type
 */
export async function resolveResponseBody<T = any>(
  rawResponse: Response,
  expectType?: FexiosConfigs['responseType'],
  onProgress?: (progress: number, buffer?: Uint8Array) => void
): Promise<FexiosResponse<T>> {
  if (rawResponse.bodyUsed) {
    throw new FexiosError(
      FexiosErrorCodes.BODY_USED,
      'Response body has already been used or locked'
    )
  }

  const contentType = rawResponse.headers.get('content-type') || ''
  const contentLength = Number(rawResponse.headers.get('content-length')) || 0

  // Helper methods for content type checking
  const isJsonContent = (contentType: string, expectType?: string) =>
    expectType === 'json' || contentType.startsWith('application/json')

  const isBinaryContent = (
    contentType: string,
    buffer: Uint8Array,
    expectType?: string
  ) =>
    expectType === 'blob' ||
    contentType.startsWith('image/') ||
    contentType.startsWith('video/') ||
    contentType.startsWith('audio/') ||
    !checkIfTextData(buffer)

  // Check if the response is a WebSocket
  if (
    (rawResponse.status === 101 ||
      rawResponse.status === 426 ||
      rawResponse.headers.get('upgrade')) &&
    typeof globalThis.WebSocket !== 'undefined'
  ) {
    const ws = new WebSocket(rawResponse.url)
    await new Promise<any>((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = reject
    })
    return new FexiosResponse(rawResponse, ws as T, {
      ok: true,
      status: 101,
      statusText: 'Switching Protocols',
    })
  }
  // Check if the response is a EventSource
  // But only if the content-type is not 'text' or 'json'
  else if (
    contentType.startsWith('text/event-stream') &&
    !['text', 'json'].includes(expectType || '') &&
    typeof globalThis.EventSource !== 'undefined'
  ) {
    const es = new EventSource(rawResponse.url)
    await new Promise<any>((resolve, reject) => {
      es.onopen = resolve
      es.onerror = reject
    })
    return new FexiosResponse(rawResponse, es as T)
  }
  // Check if expectType is 'stream'
  else if (expectType === 'stream') {
    return new FexiosResponse(
      rawResponse,
      rawResponse.body as ReadableStream as T
    )
  }
  // Check if the response is a ReadableStream
  else {
    const responseCopy = rawResponse.clone()
    const reader = responseCopy.body?.getReader()
    if (!reader) {
      throw new FexiosError(
        FexiosErrorCodes.NO_BODY_READER,
        'Failed to get ReadableStream from response body'
      )
    }
    let buffer = new Uint8Array()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      if (value) {
        buffer = new Uint8Array([...buffer, ...value])
        if (onProgress && contentLength > 0) {
          const progress = Math.min(buffer.length / contentLength, 1)
          onProgress(progress, buffer)
        }
      }
    }

    const res = new FexiosResponse(rawResponse, undefined as any)

    // Guess the response type, maybe a Blob?
    if (isBinaryContent(contentType, buffer, expectType)) {
      res.data = new Blob([buffer], {
        type: rawResponse.headers.get('content-type') || undefined,
      }) as Blob as T
    }
    // Otherwise, try to decode the buffer as text
    else {
      res.data = new TextDecoder().decode(buffer) as T
    }

    // If the data resolved as a string above, try to parse it as JSON
    if (isJsonContent(contentType, expectType)) {
      try {
        res.data = JSON.parse(res.data as string) as T
      } catch (e) {
        console.warn('Failed to parse response data as JSON:', e)
      }
    }
    if (typeof res.data === 'string' && expectType !== 'text') {
      const trimmedData = (res.data as string).trim()
      const firstChar = trimmedData[0]
      const lastChar = trimmedData[trimmedData.length - 1]
      if (
        (firstChar === '{' && lastChar === '}') ||
        (firstChar === '[' && lastChar === ']')
      ) {
        try {
          res.data = JSON.parse(res.data as string) as T
        } catch (_) {
          // NOOP
        }
      }
    }

    // Fall back to the buffer if the data is still not resolved
    if (typeof res.data === 'undefined') {
      res.data = buffer.length > 0 ? (buffer as any) : undefined
    }

    if (!res.ok) {
      throw new FexiosResponseError(
        `Request failed with status code ${rawResponse.status}`,
        res as any
      )
    } else {
      return res
    }
  }
}

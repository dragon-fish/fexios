import type {
  FexiosConfigs,
  IFexiosResponse as IFexiosResponse,
} from '../types'
import { FexiosError, FexiosErrorCodes } from './errors.js'

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
    for await (const chunk of stream as any) {
      // 大多数现代浏览器支持
      chunks.push(chunk)
      received += chunk.length
      if (onProgress && contentLength > 0)
        onProgress(received / contentLength, concat(chunks))
    }
  } finally {
    reader.releaseLock?.()
  }

  const data = concat(chunks)
  onProgress?.(1, data)
  return data

  function concat(parts: Uint8Array[]) {
    const total = parts.reduce((n, p) => n + p.length, 0)
    const out = new Uint8Array(total)
    let off = 0
    for (const p of parts) {
      out.set(p, off)
      off += p.length
    }
    return out
  }
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
 * @param expectType `undefined` means auto-detect based on content-type header. And also try JSON.stringify if it's a string.
 */
export async function createFexiosResponse<T = any>(
  rawResponse: Response,
  expectType?: FexiosConfigs['responseType'],
  onProgress?: (progress: number, buffer?: Uint8Array) => void,
  shouldThrow?: (response: FexiosResponse<any>) => boolean | void
): Promise<FexiosResponse<T>> {
  const contentType =
    rawResponse.headers.get('content-type')?.toLowerCase() ?? ''
  const lenHeader = rawResponse.headers.get('content-length')
  const total = lenHeader ? Number(lenHeader) : 0

  let resolvedType: IFexiosResponse['responseType'] =
    expectType ?? guessFexiosResponseType(contentType) ?? 'text'

  // special-cases that don't need body decoding
  if (resolvedType === 'stream') {
    const wrapped = await createFexiosEventSourceResponse(
      rawResponse.url,
      rawResponse
    )
    const decide = shouldThrow?.(wrapped)
    if (typeof decide === 'boolean' ? decide : !wrapped.ok) throw wrapped
    return wrapped as FexiosResponse<T>
  }
  if (resolvedType === 'ws') {
    // fetch 不产生 WebSocket；这里只返回占位，交由上层处理
    const wrapped = await createFexiosWebSocketResponse(
      rawResponse.url,
      rawResponse
    )
    const decide = shouldThrow?.(wrapped)
    if (typeof decide === 'boolean' ? decide : !wrapped.ok) throw wrapped
    return wrapped as FexiosResponse<T>
  }

  // decode helpers
  const charset = /\bcharset=([^;]+)/i.exec(contentType)?.[1]?.trim() || 'utf-8'
  const decoder = new TextDecoder(charset)

  let data: any

  // Choose reading path:
  const needManual =
    typeof onProgress === 'function' ||
    resolvedType === 'arrayBuffer' ||
    resolvedType === 'blob' ||
    resolvedType === 'json' ||
    resolvedType === 'text'

  try {
    if (resolvedType === 'form') {
      // formData 让 fetch 自己解析（不支持计算进度）
      data = await rawResponse.formData()
    } else if (needManual) {
      const bytes = await readBody(rawResponse.body!, total, onProgress)
      if (resolvedType === 'arrayBuffer') {
        data = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        )
      } else if (resolvedType === 'blob') {
        // @ts-ignore - Blob 在现代浏览器与 Node >=18 存在
        data = new Blob([bytes], {
          type: contentType || 'application/octet-stream',
        })
      } else if (resolvedType === 'text') {
        const text = decoder.decode(bytes)
        // auto-detect: 若未显式期望类型且文本看起来像 JSON，尝试解析为 JSON
        if (!expectType) {
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
        // 理论上覆盖不到
        data = bytes
      }
    } else {
      // 不需要进度时优先使用内建便捷方法
      switch (resolvedType) {
        case 'arrayBuffer':
          data = await rawResponse.arrayBuffer()
          break
        case 'blob':
          data = await (rawResponse as any).blob()
          break
        case 'json':
          // 某些后端返回空体但声明 json
          try {
            data = await rawResponse.json()
          } catch {
            const t = await rawResponse.text()
            data = t ? JSON.parse(t) : null
          }
          break
        case 'text':
        default: {
          const t = await rawResponse.text()
          if (!expectType) {
            const trimmed = t.trim()
            if (
              (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
              (trimmed.startsWith('[') && trimmed.endsWith(']'))
            ) {
              try {
                data = JSON.parse(trimmed)
                resolvedType = 'json'
                break
              } catch {
                // fallthrough to text
              }
            }
          }
          data = t
          break
        }
      }
    }
  } catch (e) {
    // 解析失败时，最后的保底：尝试当作纯文本读取
    if (!(e instanceof Error)) throw e
    try {
      const t = await rawResponse.text()
      data = t
      resolvedType = 'text'
    } catch {
      // 实在不行就抛原错误
      throw e
    }
  }

  const wrapped = new FexiosResponse<T>(
    rawResponse as any,
    data as T,
    resolvedType
  )

  const decision = shouldThrow?.(wrapped)
  if (typeof decision === 'boolean' ? decision : !wrapped.ok) {
    // 抛出已封装的响应，便于上层捕获并读取 data/status 等
    throw wrapped
  }

  return wrapped
}

export async function createFexiosWebSocketResponse(
  url: string | URL,
  response?: Response,
  timeout?: number
) {
  const ws = new WebSocket(url.toString())
  const delay = timeout && timeout > 0 ? timeout : Number.MAX_SAFE_INTEGER
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close()
      reject(
        new FexiosError(
          FexiosErrorCodes.TIMEOUT,
          `WebSocket connection timed out after ${delay}ms`
        )
      )
    }, delay)
    ws.addEventListener('open', () => {
      clearTimeout(timer)
      resolve()
    })
    ws.addEventListener('error', (event) => {
      clearTimeout(timer)
      reject(
        new FexiosError(
          FexiosErrorCodes.NETWORK_ERROR,
          `WebSocket connection failed`,
          undefined,
          { cause: event }
        )
      )
    })
  })
  return new FexiosResponse<WebSocket>(response || new Response(null), ws, 'ws')
}

export async function createFexiosEventSourceResponse(
  url: string | URL,
  response?: Response,
  timeout?: number
) {
  const es = new EventSource(url.toString())
  await new Promise<any>((resolve, reject) => {
    es.addEventListener('open', () => {
      resolve(undefined)
    })
    es.addEventListener('error', (event) => {
      reject(
        new FexiosError(
          FexiosErrorCodes.NETWORK_ERROR,
          `EventSource connection failed`,
          undefined,
          { cause: event }
        )
      )
    })
  })
  return new FexiosResponse<EventSource>(
    response || new Response(null),
    es,
    'stream'
  )
}

import type { FexiosPlugin } from '@/types.js'
import { FexiosError, FexiosErrorCodes } from '@/models/errors.js'
import { FexiosQueryBuilder } from '@/models/query-builder.js'

export type FexiosWebSocketOptions = {
  /**
   * WebSocket sub-protocols
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket
   */
  protocols?: string | string[]
  /**
   * Query params to append/merge into url
   */
  query?: Record<string, any> | URLSearchParams
  /**
   * Connect timeout (ms)
   * @default app.baseConfigs.timeout ?? 60000
   */
  timeout?: number
}

export type FexiosWebSocketContext = {
  url: string
  protocols?: string | string[]
  timeout: number
  socket?: WebSocket
}

declare module 'fexios' {
  interface Fexios {
    /**
     * Connect a WebSocket (moved out of core).
     * Resolves after the socket is opened.
     */
    ws: (
      url: string | URL,
      options?: FexiosWebSocketOptions
    ) => Promise<WebSocket>
  }
}

declare module 'fexios/types' {
  interface FexiosLifecycleEventMap {
    'websocket:beforeConnect': FexiosWebSocketContext
    'websocket:open': FexiosWebSocketContext
    'websocket:message': FexiosWebSocketContext & { event: MessageEvent }
    'websocket:error': FexiosWebSocketContext & { event: Event }
    'websocket:close': FexiosWebSocketContext & { event: CloseEvent }
  }
}

const toWsBase = (baseURL: string | URL) => {
  const s = baseURL.toString()
  if (s.startsWith('https://')) return s.replace(/^https:\/\//, 'wss://')
  if (s.startsWith('http://')) return s.replace(/^http:\/\//, 'ws://')
  return s
}

const normalizeWsURL = (
  url: string | URL,
  baseURL: string | URL,
  query?: Record<string, any> | URLSearchParams
) => {
  const input = url.toString()
  const base = toWsBase(baseURL)
  const normalized =
    input.startsWith('ws://') ||
    input.startsWith('wss://') ||
    input.startsWith('http://') ||
    input.startsWith('https://')
      ? input.replace(/^https?:\/\//, (m) =>
          m === 'https://' ? 'wss://' : 'ws://'
        )
      : input
  return FexiosQueryBuilder.makeURL(
    normalized,
    query as any,
    undefined,
    base
  ).toString()
}

async function waitForWsOpen(ws: WebSocket, delay: number) {
  if ((ws as any).readyState === 1) return
  await new Promise<void>((resolve, reject) => {
    const timer =
      delay > 0
        ? setTimeout(() => {
            try {
              ws.close()
            } catch {}
            reject(
              new FexiosError(
                FexiosErrorCodes.TIMEOUT,
                `WebSocket connection timed out after ${delay}ms`
              )
            )
          }, delay)
        : undefined

    const cleanup = () => {
      if (timer) clearTimeout(timer)
      ws.removeEventListener('open', onOpen)
      ws.removeEventListener('error', onError)
    }

    const onOpen = () => {
      cleanup()
      resolve()
    }
    const onError = (event: Event) => {
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

    ws.addEventListener('open', onOpen)
    ws.addEventListener('error', onError)
  })
}

export const pluginWebSocket: FexiosPlugin = {
  name: 'fexios-plugin-websocket',
  install(fx) {
    fx.ws = async (url, options) => {
      const delay = options?.timeout ?? fx.baseConfigs.timeout ?? 60_000
      const wsUrl = normalizeWsURL(
        url,
        fx.baseConfigs.baseURL || 'http://localhost',
        options?.query
      )

      const baseCtx: FexiosWebSocketContext = {
        url: wsUrl,
        protocols: options?.protocols,
        timeout: delay,
      }

      // allow user-side adjustments
      const ctx = (await (fx as any).emit(
        'websocket:beforeConnect',
        baseCtx
      )) as FexiosWebSocketContext

      const ws = new WebSocket(ctx.url, ctx.protocols as any)
      ctx.socket = ws

      ws.addEventListener('open', () => {
        ;(fx as any).emit('websocket:open', { ...ctx })
      })
      ws.addEventListener('message', (event) => {
        ;(fx as any).emit('websocket:message', { ...ctx, event })
      })
      ws.addEventListener('error', (event) => {
        ;(fx as any).emit('websocket:error', { ...ctx, event })
      })
      ws.addEventListener('close', (event) => {
        ;(fx as any).emit('websocket:close', { ...ctx, event })
      })

      await waitForWsOpen(ws, ctx.timeout)
      return ws
    }

    return fx
  },
  uninstall(fx) {
    fx.ws = undefined as any
  },
}

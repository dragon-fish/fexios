import type { FexiosPlugin } from '@/types.js'
import { FexiosError, FexiosErrorCodes } from '@/models/errors.js'
import { FexiosQueryBuilder } from '@/models/query-builder.js'

export type FexiosSSEOptions = {
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

export type FexiosSSEContext = {
  url: string
  timeout: number
  eventSource?: EventSource
}

declare module '@/index.js' {
  interface Fexios {
    /**
     * Connect SSE (EventSource) (moved out of core).
     * Resolves after the connection is opened.
     */
    sse: (url: string | URL, options?: FexiosSSEOptions) => Promise<EventSource>
  }
}

declare module '@/types.js' {
  interface FexiosLifecycleEventMap {
    'sse:beforeConnect': FexiosSSEContext
    'sse:open': FexiosSSEContext & { event: Event }
    'sse:message': FexiosSSEContext & { event: MessageEvent }
    'sse:error': FexiosSSEContext & { event: Event }
    'sse:close': FexiosSSEContext
  }
}

const normalizeSseURL = (
  url: string | URL,
  baseURL: string | URL,
  query?: Record<string, any> | URLSearchParams
) => {
  // SSE uses http(s)
  return FexiosQueryBuilder.makeURL(
    url,
    query as any,
    undefined,
    baseURL
  ).toString()
}

async function waitForSseOpen(es: EventSource, delay: number) {
  // readyState: 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
  if ((es as any).readyState === 1) return
  await new Promise<void>((resolve, reject) => {
    const timer =
      delay > 0
        ? setTimeout(() => {
            try {
              es.close()
            } catch {}
            reject(
              new FexiosError(
                FexiosErrorCodes.TIMEOUT,
                `EventSource connection timed out after ${delay}ms`
              )
            )
          }, delay)
        : undefined

    const cleanup = () => {
      if (timer) clearTimeout(timer)
      es.removeEventListener('open', onOpen as any)
      es.removeEventListener('error', onError as any)
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
          `EventSource connection failed`,
          undefined,
          { cause: event }
        )
      )
    }

    es.addEventListener('open', onOpen as any)
    es.addEventListener('error', onError as any)
  })
}

export const pluginSSE: FexiosPlugin = {
  name: 'fexios-plugin-sse',
  install(app) {
    app.sse = async (url, options) => {
      const delay = options?.timeout ?? app.baseConfigs.timeout ?? 60_000
      const sseUrl = normalizeSseURL(
        url,
        app.baseConfigs.baseURL || 'http://localhost',
        options?.query
      )

      const baseCtx: FexiosSSEContext = {
        url: sseUrl,
        timeout: delay,
      }

      const ctx = (await (app as any).emit(
        'sse:beforeConnect',
        baseCtx
      )) as FexiosSSEContext

      const es = new EventSource(ctx.url)
      ctx.eventSource = es

      es.addEventListener('open', (event) => {
        ;(app as any).emit('sse:open', { ...ctx, event })
      })
      es.addEventListener('message', (event) => {
        ;(app as any).emit('sse:message', { ...ctx, event: event as any })
      })
      es.addEventListener('error', (event) => {
        ;(app as any).emit('sse:error', { ...ctx, event })
      })

      await waitForSseOpen(es, ctx.timeout)
      return es
    }

    return app
  },
}

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
  if ((es as any).readyState === 2) {
    throw new Error('SSE connection is already closed')
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false
    // NOTE: declare timer BEFORE cleanup() to avoid TDZ when "open" fires synchronously
    // in some mock/polyfill implementations.
    let timer: ReturnType<typeof setTimeout> | undefined

    const handleOpen = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }

    const handleError = (event: Event) => {
      if (settled) return
      settled = true
      cleanup()
      reject(
        new Error('SSE connection emitted error before it was fully opened')
      )
    }

    const handleClose = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('SSE connection was closed before it was fully opened'))
    }

    const cleanup = () => {
      if (timer) clearTimeout(timer)
      es.removeEventListener('open', handleOpen as any)
      es.removeEventListener('error', handleError as any)

      // Some environments expose a dedicated "close" event on EventSource,
      // others surface a clean close via "error" instead. We defensively
      // try to unregister the "close" listener when supported.
      try {
        es.removeEventListener('close', handleClose as any)
      } catch {
        // ignore: "close" not supported by this implementation
      }
    }

    es.addEventListener('open', handleOpen as any)
    es.addEventListener('error', handleError as any)

    // If the platform exposes a dedicated "close" event (or maps it internally),
    // listen for it so a clean close does not delay failure handling until timeout.
    try {
      es.addEventListener('close', handleClose as any)
    } catch {
      // ignore: environments without a "close" event are expected to surface failures via "error"
    }

    timer =
      delay > 0
        ? setTimeout(() => {
            if (settled) return
            settled = true
            cleanup()
            try {
              es.close()
            } catch {
              // ignore; connection may already be closed
            }
            reject(new Error('opening SSE connection timed out'))
          }, delay)
        : undefined
  })
}

export const pluginSSE: FexiosPlugin = {
  name: 'fexios-plugin-sse',
  install(fx) {
    fx.sse = async (url, options) => {
      const delay = options?.timeout ?? fx.baseConfigs.timeout ?? 60_000
      const sseUrl = normalizeSseURL(
        url,
        fx.baseConfigs.baseURL || 'http://localhost',
        options?.query
      )

      const baseCtx: FexiosSSEContext = {
        url: sseUrl,
        timeout: delay,
      }

      const ctx = (await (fx as any).emit(
        'sse:beforeConnect',
        baseCtx
      )) as FexiosSSEContext

      const es = new EventSource(ctx.url)
      ctx.eventSource = es

      es.addEventListener('open', (event) => {
        ;(fx as any).emit('sse:open', { ...ctx, event })
      })
      es.addEventListener('message', (event) => {
        ;(fx as any).emit('sse:message', { ...ctx, event: event as any })
      })
      es.addEventListener('error', (event) => {
        ;(fx as any).emit('sse:error', { ...ctx, event })
      })

      try {
        await waitForSseOpen(es, ctx.timeout)
      } catch (err: any) {
        // Make sure we always reject with a FexiosError for consistent userland handling.
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
            ? err
            : 'SSE connection failed to open'

        const isTimeout =
          message.includes('timed out') || message.includes('timeout')

        throw new FexiosError(
          isTimeout ? FexiosErrorCodes.TIMEOUT : FexiosErrorCodes.NETWORK_ERROR,
          message
        )
      }
      return es
    }

    return fx
  },
  uninstall(fx) {
    fx.sse = undefined as any
  },
}

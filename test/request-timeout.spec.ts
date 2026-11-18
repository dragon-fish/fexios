import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Fexios, FexiosErrorCodes } from '../src/index'

const url = 'https://example.test/'

function createClient(
  fetchRequest: (request: Request) => Promise<Response>,
  timeout = 0
) {
  const fetch = vi.fn(fetchRequest)
  const fx = new Fexios({
    timeout,
    fetch(input) {
      if (!(input instanceof Request)) throw new TypeError('Expected a Request')
      return fetch(input)
    },
  })
  return { fx, fetch }
}

describe('HTTP request cancellation', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('preserves the reason for a pre-aborted request and skips fetch', async () => {
    const { fx, fetch } = createClient(async () => new Response('ok'))
    const abortController = new AbortController()
    const reason = new Error('Already cancelled')
    abortController.abort(reason)

    await expect(fx.get(url, { abortController })).rejects.toMatchObject({
      code: FexiosErrorCodes.ABORTED,
      cause: reason,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('aborts in-flight requests when timeout is disabled', async () => {
    const { fx, fetch } = createClient(
      (request) =>
        new Promise<Response>((_, reject) => {
          request.signal.addEventListener(
            'abort',
            () => reject(request.signal.reason),
            { once: true }
          )
        }),
      100
    )
    const abortController = new AbortController()
    const reason = new Error('Cancelled by caller')
    const result = expect(fx.get(url, { abortController, timeout: 0 }))
      .rejects.toMatchObject({ code: FexiosErrorCodes.ABORTED, cause: reason })

    await vi.advanceTimersByTimeAsync(200)
    const [[request]] = fetch.mock.calls
    expect(request.signal.aborted).toBe(false)
    abortController.abort(reason)

    await result
    expect(request.signal.aborted).toBe(true)
  })

  it('times out only the affected request with a shared caller controller', async () => {
    const { fx, fetch } = createClient(
      (request) =>
        new Promise<Response>((resolve, reject) => {
          const timer = setTimeout(() => resolve(new Response('ok')), 100)
          request.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer)
              reject(request.signal.reason)
            },
            { once: true }
          )
        })
    )
    const abortController = new AbortController()
    const first = expect(fx.get(url, { abortController, timeout: 25 }))
      .rejects.toMatchObject({ code: FexiosErrorCodes.TIMEOUT })
    const second = fx.get(url, { abortController })

    await vi.advanceTimersByTimeAsync(25)
    await first
    expect(abortController.signal.aborted).toBe(false)
    expect(fetch.mock.calls[0][0].signal.aborted).toBe(true)
    expect(fetch.mock.calls[1][0].signal.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(75)
    await expect(second).resolves.toMatchObject({ data: 'ok' })
  })

  it('times out a response with headers and a body still being read', async () => {
    const receivedHeaders = vi.fn()
    const { fx, fetch } = createClient(async (request) => {
      const body = new ReadableStream({
        start(stream) {
          stream.enqueue(new TextEncoder().encode('partial body'))
          request.signal.addEventListener(
            'abort',
            () => stream.error(request.signal.reason),
            { once: true }
          )
        },
      })
      return new Response(body, { headers: { 'content-type': 'text/plain' } })
    }, 25)
    fx.on('afterRawResponse', () => {
      receivedHeaders()
    })
    const result = expect(fx.get(url)).rejects.toMatchObject({
      code: FexiosErrorCodes.TIMEOUT,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(receivedHeaders).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(25)
    await result
    expect(fetch.mock.calls[0][0].signal.aborted).toBe(true)
  })

  it('honors the signal on a Request supplied by beforeActualFetch', async () => {
    const abortController = new AbortController()
    const reason = new Error('Cancelled by hook')
    const { fx, fetch } = createClient(() => new Promise(() => {}), 100)
    fx.on('beforeActualFetch', (ctx) => {
      ctx.request.rawRequest = new Request(url, { signal: abortController.signal })
    })
    const result = expect(fx.get(url)).rejects.toMatchObject({
      code: FexiosErrorCodes.ABORTED,
      cause: reason,
    })

    await vi.advanceTimersByTimeAsync(0)
    abortController.abort(reason)

    await result
    expect(fetch.mock.calls[0][0].signal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the timeout before running afterResponse hooks', async () => {
    const { fx, fetch } = createClient(async () => new Response('ok'), 25)
    fx.on('afterResponse', async () => {
      await vi.advanceTimersByTimeAsync(50)
    })

    await expect(fx.get(url)).resolves.toMatchObject({ data: 'ok' })
    expect(fetch.mock.calls[0][0].signal.aborted).toBe(false)
  })
})

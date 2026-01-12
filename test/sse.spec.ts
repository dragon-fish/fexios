import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Fexios, FexiosError, FexiosErrorCodes } from '../src/index'
import { pluginSSE } from '../src/plugins/index.js'
import { MockEventSource, MOCK_FETCH_BASE_URL } from './mockFetch'

const SSE_URL = `${MOCK_FETCH_BASE_URL}/_sse`

describe('SSE', () => {
  let originalEventSource: any

  beforeAll(() => {
    // Mock EventSource globally
    originalEventSource = (globalThis as any).EventSource
    ;(globalThis as any).EventSource = MockEventSource
  })

  afterAll(() => {
    // Restore original EventSource
    if (originalEventSource) {
      ;(globalThis as any).EventSource = originalEventSource
    }
  })

  it('Legacy usage should throw plugin guidance error (text/event-stream)', async () => {
    const fx = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: async () =>
        new Response(null, {
          headers: { 'content-type': 'text/event-stream' },
        }),
    })
    await expect(fx.get('/anything' as any)).rejects.toMatchObject({
      code: FexiosErrorCodes.FEATURE_MOVED_TO_PLUGIN,
    })
  })

  it('Server Sent Events via plugin (fx.sse)', async () => {
    expect(pluginSSE).toBeDefined()
    expect(typeof (pluginSSE as any).install).to.equal('function')
    let fx: any = new Fexios({ baseURL: MOCK_FETCH_BASE_URL })
    fx = await fx.plugin(pluginSSE)
    const sse = (await fx.sse(SSE_URL, {
      query: { timeout: 3 },
    })) as any as MockEventSource
    let messages: any[] = []
    await new Promise<void>((resolve) => {
      sse.onmessage = (event) => {
        messages.push(event.data)
        if (messages.length === 3) {
          resolve()
        }
      }
    })
    sse.close()
    expect(messages.length).to.equal(3)
    expect(messages[0]).to.include('Message 1')
    expect(messages[1]).to.include('Message 2')
    expect(messages[2]).to.include('Message 3')
  })

  it('Honors timeout in plugin when EventSource never opens', async () => {
    const originalEventSource2 = (globalThis as any).EventSource
    class HangingEventSource {
      url: string
      listeners = new Map<string, Set<(event: any) => void>>()
      constructor(url: string) {
        this.url = url
      }
      addEventListener(type: string, listener: (event: any) => void) {
        if (!this.listeners.has(type)) {
          this.listeners.set(type, new Set())
        }
        this.listeners.get(type)!.add(listener)
      }
      removeEventListener(type: string, listener: (event: any) => void) {
        this.listeners.get(type)?.delete(listener)
      }
      close() {
        // no-op
      }
    }

    try {
      ;(globalThis as any).EventSource = HangingEventSource
      let fx: any = new Fexios({ baseURL: MOCK_FETCH_BASE_URL, timeout: 25 })
      fx = await fx.plugin(pluginSSE)
      await expect(fx.sse(SSE_URL)).rejects.toBeInstanceOf(FexiosError)
    } finally {
      ;(globalThis as any).EventSource = originalEventSource2
    }
  })
})

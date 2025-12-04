import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import fexios, { Fexios } from '../src/index'
import * as ModelExports from '../src/models/index.js'
import { mockFetch, MockEventSource, MOCK_FETCH_BASE_URL } from './mockFetch'

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

  it('Server Sent Events', async () => {
    const { data: sse } = await fexios.get<MockEventSource>(SSE_URL, {
      query: { timeout: 3 },
      fetch: mockFetch,
    })
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

  it('Honors resolved timeout when EventSource never opens', async () => {
    const originalEventSource = (globalThis as any).EventSource
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

    ;(globalThis as any).EventSource = HangingEventSource
    const res = new Response(null, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
      },
    })
    Object.defineProperty(res, 'url', { value: SSE_URL, writable: false })

    try {
      await expect(
        ModelExports.createFexiosResponse(
          res,
          undefined,
          undefined,
          undefined,
          25
        )
      ).rejects.toThrow('EventSource connection timed out after 25ms')
    } finally {
      ;(globalThis as any).EventSource = originalEventSource
    }
  })
})

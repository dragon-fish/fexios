import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import fexios from '../src/index'
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
})

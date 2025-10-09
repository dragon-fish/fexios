import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import fexios from '../src/index'
import { MockWebSocket, MOCK_FETCH_BASE_URL, mockFetch } from './mockFetch'

const WS_URL = `${MOCK_FETCH_BASE_URL}/_ws`

describe('WebSocket', () => {
  let originalWebSocket: any

  beforeAll(() => {
    // Mock WebSocket globally
    originalWebSocket = (globalThis as any).WebSocket
    ;(globalThis as any).WebSocket = MockWebSocket
  })

  afterAll(() => {
    // Restore original WebSocket
    if (originalWebSocket) {
      ;(globalThis as any).WebSocket = originalWebSocket
    }
  })

  it('Should return WebSocket', async () => {
    const { data } = await fexios.get<MockWebSocket>(WS_URL, {
      fetch: mockFetch,
    })
    expect(data).to.be.instanceOf(MockWebSocket)
    data?.close()
  })

  it('Should handle ws:// or wss://', async () => {
    const { data } = await fexios.get<MockWebSocket>(
      WS_URL.replace(/^http/, 'ws')
    )
    expect(data).to.be.instanceOf(MockWebSocket)
    data?.close()
  })

  it('WebSocket message', async () => {
    const { data: ws } = await fexios.get<MockWebSocket>(WS_URL, {
      fetch: mockFetch,
    })
    const now = '' + Date.now()
    ws.send(now)
    const response = await new Promise<string>((resolve) => {
      ws.addEventListener('message', (event) => {
        // Skip the initial URL message sent by the mock
        if (event.data === ws.url) return
        resolve(event.data)
      })
    })
    expect(response).to.equal(now)
    ws.close()
  })
})

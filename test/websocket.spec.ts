import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { Fexios, FexiosError, FexiosErrorCodes } from '../src/index'
import { pluginWebSocket } from '../src/plugins/index.js'
import { MockWebSocket, MOCK_FETCH_BASE_URL } from './mockFetch'

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

  it('Legacy usage should throw plugin guidance error', async () => {
    const fx = new Fexios({ baseURL: MOCK_FETCH_BASE_URL })
    await expect(
      fx.get(WS_URL.replace(/^http/, 'ws') as any)
    ).rejects.toMatchObject({ code: FexiosErrorCodes.FEATURE_MOVED_TO_PLUGIN })
  })

  it('Should connect via plugin (fx.ws)', async () => {
    expect(pluginWebSocket).toBeDefined()
    expect(typeof (pluginWebSocket as any).install).to.equal('function')
    let fx: any = new Fexios({ baseURL: MOCK_FETCH_BASE_URL })
    fx = await fx.plugin(pluginWebSocket)
    const ws = await fx.ws(WS_URL.replace(/^http/, 'ws'))
    expect(ws).to.be.instanceOf(MockWebSocket)
    ws.close()
  })

  it('WebSocket message', async () => {
    let fx: any = new Fexios({ baseURL: MOCK_FETCH_BASE_URL })
    fx = await fx.plugin(pluginWebSocket)
    const ws = (await fx.ws(
      WS_URL.replace(/^http/, 'ws')
    )) as any as MockWebSocket
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

  it('Honors timeout in plugin when socket never opens', async () => {
    class HangingWebSocket {
      public url: string
      public readyState: number = 0 // CONNECTING
      private listeners = new Map<string, Set<(event: any) => void>>()
      constructor(url: string) {
        this.url = url
      }
      addEventListener(type: string, listener: (event: any) => void) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set())
        this.listeners.get(type)!.add(listener)
      }
      removeEventListener(type: string, listener: (event: any) => void) {
        this.listeners.get(type)?.delete(listener)
      }
      close() {
        this.readyState = 3
      }
      // no open/error events will be emitted -> should timeout
    }
    const prev = (globalThis as any).WebSocket
    ;(globalThis as any).WebSocket = HangingWebSocket
    try {
      let fx: any = new Fexios({ baseURL: MOCK_FETCH_BASE_URL, timeout: 25 })
      fx = await fx.plugin(pluginWebSocket)
      await expect(fx.ws(WS_URL.replace(/^http/, 'ws'))).rejects.toBeInstanceOf(
        FexiosError
      )
    } finally {
      ;(globalThis as any).WebSocket = prev
    }
  })
})

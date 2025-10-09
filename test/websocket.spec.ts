import { describe, expect, it } from 'vitest'
import fexios from '../src/index'

// TODO: use mockFetch
const WS_URL = 'https://echo.epb.wiki/_ws'

describe('WebSocket', () => {
  it('Should return WebSocket', async () => {
    const { data } = await fexios.get<WebSocket>(WS_URL)
    expect(data).to.be.instanceOf(WebSocket)
    data?.close()
  })

  it('Should handle ws:// or wss://', async () => {
    const { data } = await fexios.get<WebSocket>(WS_URL.replace(/^http/, 'ws'))
    expect(data).to.be.instanceOf(WebSocket)
    data?.close()
  })

  it('WebSocket message', async () => {
    const { data: ws } = await fexios.get<WebSocket>(WS_URL)
    const now = '' + Date.now()
    ws.send(now)
    const response = await new Promise<string>((resolve) => {
      ws.addEventListener('message', (event) => {
        if (event.data === WS_URL) return
        resolve(event.data)
      })
    })
    expect(response).to.equal(now)
    ws.close()
  })
})

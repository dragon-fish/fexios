import { describe, expect, it } from 'vitest'
import fexios from '../src/index'
import { EventSource } from 'eventsource'
;(globalThis as any).EventSource = EventSource

// TODO: use mockFetch
const SSE_URL = 'https://echo.epb.wiki/_sse'

describe('SSE', () => {
  it('Server Sent Events', async () => {
    const { data: sse } = await fexios.get<EventSource>(SSE_URL, {
      query: { timeout: 3 },
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
    expect(messages.length).to.gt(0)
  })
})

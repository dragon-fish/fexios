import { describe, expect, it } from 'vitest'
import { Fexios } from '../src/index'

describe('Fexios Response - rawResponse unread (cloned)', () => {
  it('JSON: ctx.rawResponse should remain unread and equal ctx.response.rawResponse', async () => {
    const fx = new Fexios({
      fetch: async () => {
        return new Response(JSON.stringify({ ok: true, n: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })

    const ctx = await fx.get<{ ok: boolean; n: number }>('https://example.com')

    // library has already parsed ctx.data
    expect(ctx.data).to.deep.equal({ ok: true, n: 1 })
    expect(ctx.response.responseType).to.equal('json')

    // raw response exposed to user should remain unread
    expect(ctx.rawResponse.bodyUsed).to.equal(false)
    expect(ctx.response.rawResponse.bodyUsed).to.equal(false)
    expect(ctx.rawResponse).to.equal(ctx.response.rawResponse)

    // user can still read it (once)
    const userJson = await ctx.rawResponse.json()
    expect(userJson).to.deep.equal({ ok: true, n: 1 })
    expect(ctx.rawResponse.bodyUsed).to.equal(true)
    expect(ctx.response.rawResponse.bodyUsed).to.equal(true)
  })

  it('Text: ctx.rawResponse should remain unread and equal ctx.response.rawResponse', async () => {
    const fx = new Fexios({
      fetch: async () => {
        return new Response('hello', {
          status: 200,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      },
    })

    const ctx = await fx.get<string>('https://example.com')

    expect(ctx.data).to.equal('hello')
    expect(ctx.response.responseType).to.equal('text')

    expect(ctx.rawResponse.bodyUsed).to.equal(false)
    expect(ctx.response.rawResponse.bodyUsed).to.equal(false)
    expect(ctx.rawResponse).to.equal(ctx.response.rawResponse)

    const userText = await ctx.rawResponse.text()
    expect(userText).to.equal('hello')
    expect(ctx.rawResponse.bodyUsed).to.equal(true)
    expect(ctx.response.rawResponse.bodyUsed).to.equal(true)
  })
})

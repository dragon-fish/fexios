import { describe, expect, it } from 'vitest'
import { Fexios } from '../src/index'

describe('Fexios Response - rawResponse unread (cloned)', () => {
  it('JSON: ctx.response.rawResponse should remain unread for user-side handling', async () => {
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

    // original raw response in ctx is consumed by library
    expect(ctx.rawResponse.bodyUsed).to.equal(true)

    // but the rawResponse returned to user is a clone and should be unread
    expect(ctx.response.rawResponse.bodyUsed).to.equal(false)

    // user can still read it (once)
    const userJson = await ctx.response.rawResponse.json()
    expect(userJson).to.deep.equal({ ok: true, n: 1 })
    expect(ctx.response.rawResponse.bodyUsed).to.equal(true)
  })

  it('Text: ctx.response.rawResponse should remain unread for user-side handling', async () => {
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

    expect(ctx.rawResponse.bodyUsed).to.equal(true)
    expect(ctx.response.rawResponse.bodyUsed).to.equal(false)

    const userText = await ctx.response.rawResponse.text()
    expect(userText).to.equal('hello')
    expect(ctx.response.rawResponse.bodyUsed).to.equal(true)
  })
})


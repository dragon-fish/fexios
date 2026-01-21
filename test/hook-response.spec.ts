import { describe, expect, it } from 'vitest'
import { Fexios, FexiosResponse } from '../src/index'
import type { FetchLike } from '../src/types'
import { mockFetch, MOCK_FETCH_BASE_URL } from './mockFetch.js'

describe('Fexios Hooks - Response short-circuit', () => {
  it('[HOOKS] short-circuit when hook returns Response (beforeRequest)', async () => {
    const failFetch: FetchLike = async () => {
      throw new Error('fetch should not be called')
    }

    const fx = new Fexios({
      baseURL: 'https://example.com',
      fetch: failFetch,
    })

    let afterCalled = 0

    fx.on('beforeRequest', () => {
      return Response.json(
        { hi: 'there' },
        { status: 201, headers: { 'x-test': '1' } }
      )
    })

    fx.on('afterResponse', (ctx) => {
      afterCalled++
      expect(ctx.response.status).to.equal(201)
      expect(ctx.headers).to.be.instanceOf(Headers)
      expect((ctx.data as any).hi).to.equal('there')
      ;(ctx.data as any).extra = 'ok'
      return ctx
    })

    const res = await fx.get('/anything/1')
    expect(afterCalled).to.equal(1)
    expect((res.data as any).extra).to.equal('ok')
  })

  it('[HOOKS] afterResponse can replace result by returning Response', async () => {
    const fx = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })

    let secondAfterCalled = false

    // First afterResponse replaces the result
    fx.on('afterResponse', () => {
      return Response.json({ replaced: true }, { status: 202 })
    })

    // Should NOT be called because the previous hook finalized the response
    fx.on('afterResponse', () => {
      secondAfterCalled = true
    })

    const res = await fx.get('/get')
    expect(res.response.status).to.equal(202)
    expect((res.data as any).replaced).to.equal(true)
    expect(secondAfterCalled).to.equal(false)
  })

  it('[HOOKS] short-circuit when hook returns FexiosResponse (beforeRequest)', async () => {
    const failFetch: FetchLike = async () => {
      throw new Error('fetch should not be called')
    }

    const fx = new Fexios({
      baseURL: 'https://example.com',
      fetch: failFetch,
    })

    let afterCalled = 0

    fx.on('beforeRequest', () => {
      const raw = Response.json({ hi: 'there' }, { status: 200 })
      return new FexiosResponse(raw, { hi: 'there' }, 'json')
    })

    fx.on('afterResponse', (ctx) => {
      afterCalled++
      expect(ctx.response.status).to.equal(200)
      expect((ctx.data as any).hi).to.equal('there')
      return ctx
    })

    const res = await fx.get('/anything/1')
    expect(afterCalled).to.equal(1)
    expect((res.data as any).hi).to.equal('there')
  })

  it('[HOOKS] short-circuit when hook returns fetch() (Promise<Response>)', async () => {
    let requestFetchCalled = 0
    const failFetch: FetchLike = async () => {
      requestFetchCalled++
      throw new Error('request fetch should not be called')
    }

    let hookFetchCalled = 0
    const hookFetch: FetchLike = async () => {
      hookFetchCalled++
      return Response.json({ via: 'hook-fetch' }, { status: 203 })
    }

    const fx = new Fexios({
      baseURL: 'https://example.com',
      fetch: failFetch,
    })

    let afterCalled = 0

    fx.on('beforeRequest', () => {
      return hookFetch('https://example.com/short-circuit')
    })

    fx.on('afterResponse', (ctx) => {
      afterCalled++
      expect(ctx.response.status).to.equal(203)
      expect((ctx.data as any).via).to.equal('hook-fetch')
      return ctx
    })

    const res = await fx.get('/anything/1')
    expect((res.data as any).via).to.equal('hook-fetch')
    expect(afterCalled).to.equal(1)
    expect(requestFetchCalled).to.equal(0)
    expect(hookFetchCalled).to.equal(1)
  })

  it('[HOOKS] can redirect by returning another fexios request (beforeActualFetch)', async () => {
    const fx = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })

    fx.on('beforeActualFetch', (ctx) => {
      // Avoid infinite recursion: only redirect the original path.
      if ((ctx.request.url as string).includes('/anything/1')) {
        return fx.get('/anything/2')
      }
      return ctx
    })

    const res = await fx.get('/anything/1')
    expect((res.data as any).url).to.equal(`${MOCK_FETCH_BASE_URL}/anything/2`)
  })
})

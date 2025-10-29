import { describe, expect, it } from 'vitest'
import { Fexios, FexiosFinalContext } from '../src/index'
import { mockFetch, EchoResponse, MOCK_FETCH_BASE_URL } from './mockFetch.js'

const time = '' + Date.now()

describe('Fexios Hooks', () => {
  it('[HOOKS] register hooks', async () => {
    const fexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })
    fexios.on('beforeInit', (ctx) => {
      expect(ctx.url).to.equal('/anything/1')
      ctx.url = '/anything/2'
      ctx.query = {
        foo: 'bar',
      }
      return ctx
    })
    fexios.on('beforeRequest', (ctx) => {
      expect(ctx.url).to.equal(`${MOCK_FETCH_BASE_URL}/anything/2`)
      expect((ctx as any).query.foo).to.equal('bar')
      // update path via url, and update query via ctx.query
      ctx.url = ctx.url.replace('2', '3')
      ctx.query = { ...(ctx as any).query, foo: 'baz' }
      return ctx
    })
    fexios.on('afterResponse', (ctx) => {
      expect(ctx.data).to.be.an('object')
      expect(ctx.data.url).to.equal(`${MOCK_FETCH_BASE_URL}/anything/3?foo=baz`)
      ctx.data._meta.foo = time
      return ctx
    })
    const { data } = await fexios.get<EchoResponse>('/anything/1')
    expect((data._meta as any).foo).to.equal(time)
  })

  it('[HOOKS] ignore unexpected hooks', async () => {
    const fexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })
    const now = Date.now()
    let realResponse: FexiosFinalContext<EchoResponse>
    let invalidCallback: Error
    try {
      // @ts-expect-error not a function
      fexios.on('beforeInit', null)
    } catch (e: any) {
      invalidCallback = e
    }
    fexios.on('afterResponse', (_) => {
      return
    })
    // @ts-expect-error
    fexios.on('afterResponse', (_) => {
      return { data: { foo: 'bar' } }
    })
    fexios.on('afterResponse', (ctx) => {
      realResponse = ctx as FexiosFinalContext
      return Promise.reject(now)
    })
    const response = await fexios.get<EchoResponse>(`/${now}`).catch((e) => e)
    expect(invalidCallback!).to.be.an('error')
    expect(realResponse!.data?.pathname).to.equal(`/${now}`)
    expect(response).to.equal(now)
  })

  it('[HOOKS] interceptors sugar', async () => {
    const fexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })
    fexios.interceptors.request.use((ctx) => {
      expect(ctx.url).to.equal(`${MOCK_FETCH_BASE_URL}/anything/1`)
      ctx.url = ctx.url.replace('1', '2')
      return ctx
    })
    fexios.interceptors.response.use((ctx) => {
      expect(ctx.data).to.be.an('object')
      expect(ctx.data.url).to.equal(`${MOCK_FETCH_BASE_URL}/anything/2`)
      ctx.data.id = time
      return ctx
    })
    const { data } = await fexios.get('/anything/1')
    expect(data.id).to.equal(time)
  })

  it('[HOOKS] modify request params in afterBodyTransformed', async () => {
    const fexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })

    // prepare base url and initial query in beforeInit
    fexios.on('beforeInit', (ctx) => {
      ctx.url = '/anything/hook'
      ctx.query = { a: '1' }
      return ctx
    })

    // ensure normalized url before body transformed
    fexios.on('beforeRequest', (ctx) => {
      expect(ctx.url).to.equal(`${MOCK_FETCH_BASE_URL}/anything/hook`)
      expect((ctx as any).query.a).to.equal('1')
      return ctx
    })

    // modify url (path + query) in afterBodyTransformed
    fexios.on('afterBodyTransformed', (ctx) => {
      const u = new URL(ctx.url)
      u.pathname = '/anything/after'
      u.searchParams.set('q', 'after')
      ctx.url = '' + u
      return ctx
    })

    // verify the final request actually reflects modifications
    fexios.on('afterResponse', (ctx) => {
      expect(ctx.data).to.be.an('object')
      const resUrl = new URL(ctx.data.url)
      expect(resUrl.pathname).to.equal('/anything/after')
      expect(resUrl.searchParams.get('a')).to.equal('1')
      expect(resUrl.searchParams.get('q')).to.equal('after')
      return ctx
    })

    await fexios.get('/ignored')
  })

  it('[HOOKS] modify ctx.query in beforeRequest should reflect in final url', async () => {
    const fexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })

    // initial url with query from url string
    fexios.on('beforeInit', (ctx) => {
      ctx.url = '/anything/qr?foo=1&keep=ok'
      return ctx
    })

    // change query in beforeRequest
    fexios.on('beforeRequest', (ctx) => {
      // here we override foo and add bar, keep remains
      ctx.query = { ...ctx.query, foo: '2', bar: 'x' }
      return ctx
    })

    fexios.on('afterResponse', (ctx) => {
      const resUrl = new URL(ctx.data.url)
      expect(resUrl.searchParams.get('foo')).to.equal('2')
      expect(resUrl.searchParams.get('bar')).to.equal('x')
      expect(resUrl.searchParams.get('keep')).to.equal('ok')
      return ctx
    })

    await fexios.get('/ignored')
  })

  it('[HOOKS] modify ctx.query in afterBodyTransformed should reflect in final url', async () => {
    const fexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })

    fexios.on('beforeInit', (ctx) => {
      ctx.url = '/anything/after-query?x=1'
      ctx.query = { y: '2' }
      return ctx
    })

    fexios.on('afterBodyTransformed', (ctx) => {
      // override x and add z via query mutation
      ctx.query = { ...ctx.query, x: '9', z: 'ok' }
      return ctx
    })

    fexios.on('afterResponse', (ctx) => {
      const resUrl = new URL(ctx.data.url)
      expect(resUrl.searchParams.get('x')).to.equal('9')
      expect(resUrl.searchParams.get('y')).to.equal('2')
      expect(resUrl.searchParams.get('z')).to.equal('ok')
      return ctx
    })

    await fexios.get('/ignored')
  })
})

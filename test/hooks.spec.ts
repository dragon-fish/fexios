import { describe, expect, it } from 'vitest'
import { Fexios, FexiosFinalContext } from '../src/index'
import { EchoResponse } from './MockData'
import { ECHO_BASE_URL } from './constants'

const time = '' + Date.now()

describe('Fexios Hooks', () => {
  it('[HOOKS] register hooks', async () => {
    const fexios = new Fexios({
      baseURL: ECHO_BASE_URL,
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
      expect(ctx.url).to.equal(`${ECHO_BASE_URL}/anything/2?foo=bar`)
      ctx.url = ctx.url.replace('2', '3').replace('bar', 'baz')
      return ctx
    })
    fexios.on('afterResponse', (ctx) => {
      expect(ctx.data).to.be.an('object')
      expect(ctx.data.url).to.equal(`${ECHO_BASE_URL}/anything/3?foo=baz`)
      ctx.data._meta.foo = time
      return ctx
    })
    const { data } = await fexios.get<EchoResponse>('/anything/1')
    expect(data._meta.foo).to.equal(time)
  })

  it('[HOOKS] ignore unexpected hooks', async () => {
    const fexios = new Fexios({
      baseURL: ECHO_BASE_URL,
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
    // @ts-expect-error
    fexios.on('afterResponse', (ctx) => {
      return
    })
    // @ts-expect-error
    fexios.on('afterResponse', (ctx) => {
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
      baseURL: ECHO_BASE_URL,
    })
    fexios.interceptors.request.use((ctx) => {
      expect(ctx.url).to.equal(`${ECHO_BASE_URL}/anything/1`)
      ctx.url = ctx.url.replace('1', '2')
      return ctx
    })
    fexios.interceptors.response.use((ctx) => {
      expect(ctx.data).to.be.an('object')
      expect(ctx.data.url).to.equal(`${ECHO_BASE_URL}/anything/2`)
      ctx.data.id = time
      return ctx
    })
    const { data } = await fexios.get('/anything/1')
    expect(data.id).to.equal(time)
  })
})

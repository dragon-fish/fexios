import { Fexios } from '../src/index'
import { describe, it } from 'mocha'
import { expect } from 'chai'
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
      ctx.data.uuid = time
      return ctx
    })
    const { data } = await fexios.get<EchoResponse>('/anything/1')
    expect(data.uuid).to.equal(time)
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

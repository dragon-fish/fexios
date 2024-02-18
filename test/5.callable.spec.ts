import { describe, expect, it } from 'vitest'
import fexios, { Fexios } from '../src/index'
import { EchoResponse } from './MockData'
import { ECHO_BASE_URL } from './constants'

// @ts-ignore
globalThis.location = new URL(ECHO_BASE_URL)

describe('Callable Instance', () => {
  it('default export', async () => {
    const res = await fexios<EchoResponse>('/foo')
    expect(res.data.url).to.equal(`${ECHO_BASE_URL}/foo`)
  })

  it('new instance', async () => {
    const fexios = new Fexios()
    const res = await fexios<EchoResponse>('/bar')
    expect(res.data.url).to.equal(`${ECHO_BASE_URL}/bar`)
  })

  it('url with options', async () => {
    const res = await fexios<EchoResponse>('/path', { query: { foo: 'bar' } })
    expect(res.data.pathname).to.equal(`/path`)
    expect(res.data.searchParams.foo).to.equal('bar')
  })

  it('options standalone', async () => {
    const res = await fexios<EchoResponse>({
      url: '/path',
      method: 'POST',
      body: { foo: 'bar' },
    })
    expect(res.data.url).to.equal(`${ECHO_BASE_URL}/path`)
    expect(res.data.method).to.equal('POST')
    expect(res.data.body.foo).to.equal('bar')
  })
})

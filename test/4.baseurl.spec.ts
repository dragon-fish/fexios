import fexios, { Fexios } from '../src/index'
import { describe, it } from 'mocha'
import { expect } from 'chai'
import { EchoResponse } from './MockData'
import { ECHO_BASE_URL } from './constants'

// @ts-ignore
globalThis.location = new URL(ECHO_BASE_URL)

describe('baseURL like browser env', () => {
  it('empty baseURL', async () => {
    const res = await fexios.get('/foo')
    expect(res.data.url).to.equal(`${ECHO_BASE_URL}/foo`)
  })

  it('absolute path as baseURL', async () => {
    const fexios = new Fexios({
      baseURL: '/foo',
    })
    const res = await fexios.get<EchoResponse>('')
    expect(res.data.url).to.equal(`${ECHO_BASE_URL}/foo`)
  })
})

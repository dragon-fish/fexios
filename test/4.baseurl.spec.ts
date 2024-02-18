import { describe, expect, it } from 'vitest'
import fexios, { Fexios } from '../src/index'
import { EchoResponse } from './MockData'
import { ECHO_BASE_URL } from './constants'

// @ts-ignore
globalThis.location = new URL(ECHO_BASE_URL)

describe('Special baseURL', () => {
  it('Without baseURL, request with absolute path', async () => {
    const res = await fexios.get<EchoResponse>('/api.php')
    expect(res.data.url).to.equal(`${ECHO_BASE_URL}/api.php`)
  })

  it('Absolute path as baseURL', async () => {
    const fexios = new Fexios({
      baseURL: '/api.php',
    })
    const res = await fexios.get<EchoResponse>('')
    expect(res.data.url).to.equal(`${ECHO_BASE_URL}/api.php`)
  })
})

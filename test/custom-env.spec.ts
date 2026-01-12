import { describe, expect, it } from 'vitest'
import { Fexios } from '../src/index'
import { mockFetch, MOCK_FETCH_BASE_URL } from './mockFetch'

describe('Custom Environment', () => {
  it('should pass customEnv through hooks', async () => {
    const fexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })

    let envInBeforeRequest: any
    let envInAfterResponse: any

    fexios.on('beforeRequest', (ctx) => {
      envInBeforeRequest = ctx.runtime.customEnv
      ctx.runtime.customEnv = { ...ctx.runtime.customEnv, modified: true }
      return ctx
    })

    fexios.on('afterResponse', (ctx) => {
      envInAfterResponse = ctx.runtime.customEnv
      return ctx
    })

    await fexios.get('/test', {
      customEnv: { initial: true },
    })

    expect(envInBeforeRequest).toEqual({ initial: true })
    expect(envInAfterResponse).toEqual({ initial: true, modified: true })
  })

  it('should inherit customEnv from instance defaults', async () => {
    const fexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
      // @ts-expect-error customEnv is not in FexiosConfigs but should work if passed
      customEnv: { fromInstance: true },
    })

    let capturedEnv: any

    fexios.on('beforeRequest', (ctx) => {
      capturedEnv = ctx.runtime.customEnv
      return ctx
    })

    await fexios.get('/test')

    expect(capturedEnv).toEqual({ fromInstance: true })
  })
})

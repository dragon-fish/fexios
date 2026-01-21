import { describe, it, expect } from 'vitest'
import { createFexiosResponse } from '../src/models/response'

describe('createFexiosResponse auto-detection', () => {
  it('should parse JSON when Content-Type is text/plain but body simulates JSON', async () => {
    const jsonBody = JSON.stringify({ foo: 'bar' })
    const res = new Response(jsonBody, {
      headers: { 'content-type': 'text/plain' },
    })

    // @ts-ignore
    const fRes = await createFexiosResponse(res)

    expect(fRes.responseType).toBe('json')
    expect(fRes.data).toEqual({ foo: 'bar' })
  })

  it('should parse JSON when Content-Type is missing but body simulates JSON', async () => {
    const jsonBody = JSON.stringify({ foo: 'bar' })
    const res = new Response(jsonBody)

    // @ts-ignore
    const fRes = await createFexiosResponse(res)

    expect(fRes.responseType).toBe('json')
    expect(fRes.data).toEqual({ foo: 'bar' })
  })

  it('should fallback to text if JSON parse fails', async () => {
    const textBody = 'not json'
    const res = new Response(textBody)

    // @ts-ignore
    const fRes = await createFexiosResponse(res)

    expect(fRes.responseType).toBe('text')
    expect(fRes.data).toBe('not json')
  })
})

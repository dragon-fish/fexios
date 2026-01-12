import { describe, expect, it } from 'vitest'
import { Fexios } from '@/index.js'
import { mockFetch, MOCK_FETCH_BASE_URL } from '@/../test/mockFetch.js'
import { pluginPostForm } from './index.js'

describe('Post Form Plugin', () => {
  it('should post FormData via fx.postForm()', async () => {
    const fx = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })
    fx.plugin(pluginPostForm)

    const form = new FormData()
    form.set('a', '1')
    form.set('b', '2')

    const res = await fx.postForm('/post', form)

    expect(res.data.method).toBe('POST')
    expect(res.data.formData).toEqual({ a: '1', b: '2' })
  })

  it('should accept a plain object (string | Blob) and send as multipart form', async () => {
    const fx = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
      fetch: mockFetch,
    })
    fx.plugin(pluginPostForm)

    const res = await fx.postForm('/post', {
      a: '1',
      file: new Blob(['hello'], { type: 'text/plain' }),
    })

    expect(res.data.method).toBe('POST')
    expect(res.data.formData?.a).toBe('1')
    // mockFetch will treat Blob as file and put a placeholder URL into formData
    expect(typeof (res.data.formData as any)?.file).toBe('string')
    expect(res.data.binaryFiles.length).toBe(1)
  })
})

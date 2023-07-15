import fexios, { Fexios } from '../src/index'
import { describe, it } from 'mocha'
import { expect } from 'chai'
import { Todo, Comment, Post, HttpBinEcho } from './MockData'

describe('Fexios Core', () => {
  it('Request with full url', async () => {
    const { data } = await fexios.get<HttpBinEcho>('https://httpbin.org/get')
    expect(data).to.be.an('object')
  })

  it('Request to absolute path with baseURL', async () => {
    const fexios = new Fexios({
      baseURL: 'https://httpbin.org',
    })
    const { data } = await fexios.get<HttpBinEcho>('/anything/foo')
    expect(data.url).to.equal('https://httpbin.org/anything/foo')
  })

  it('Merge query params', async () => {
    const fexios = new Fexios({
      baseURL: 'https://httpbin.org',
    })
    const fexiosWithQueryInit = fexios.extends({
      query: {
        postId: '1',
      },
    })

    // baseOptions
    const { data: data1 } = await fexiosWithQueryInit.get<HttpBinEcho>('/get')
    expect(data1.args.postId).to.equal('1')

    // requestOptions
    const { data: data2 } = await fexios.get<HttpBinEcho>('/get', {
      query: {
        postId: '2',
      },
    })
    expect(data2.args.postId).to.equal('2')

    // requestOptions > urlParams > baseOptions
    const { data: data3 } = await fexiosWithQueryInit.get<HttpBinEcho>(
      '/get?postId=2',
      {
        query: {
          postId: '3',
        },
      }
    )
    expect(data3.args.postId).to.equal('3')
  })

  it('POST with JSON body', async () => {
    const fexios = new Fexios({
      baseURL: 'https://httpbin.org',
    })
    const time = '' + Date.now()
    const { data } = await fexios.post<HttpBinEcho>('/post', {
      time,
    })
    expect(data.json.time).to.equal(time)
  })

  it('POST with Form body', async () => {
    const fexios = new Fexios({
      baseURL: 'http://localhost:4321',
    })
    const form = new URLSearchParams()
    const time = '' + Date.now()
    form.set('time', time)
    const { data } = await fexios.post<HttpBinEcho>(
      'https://httpbin.org/post',
      form
    )
    expect(data.form.time).to.equal(time)
  })
})

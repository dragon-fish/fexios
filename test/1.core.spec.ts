import fexios, { Fexios } from '../src/index'
import { describe, it } from 'mocha'
import { expect } from 'chai'
import { HttpBinEcho, PostmanEcho } from './MockData'
import { POSTMANECHO_BASE_URL, HTTPBIN_BASE_URL } from './constants'

const time = '' + Date.now()

describe('Fexios Core', () => {
  it('Request with full url', async () => {
    const { data } = await fexios.get<PostmanEcho>(
      `${POSTMANECHO_BASE_URL}/get`
    )
    expect(data).to.be.an('object')
  })

  it('Request to absolute path with baseURL', async () => {
    const fexios = new Fexios({
      baseURL: HTTPBIN_BASE_URL,
    })
    const { data } = await fexios.get<HttpBinEcho>('/anything/foo')
    expect(data.url).to.equal(`${HTTPBIN_BASE_URL}/anything/foo`)
  })

  it('Merge query params', async () => {
    const fexios = new Fexios({
      baseURL: POSTMANECHO_BASE_URL,
    })
    const fexiosWithQueryInit = fexios.extends({
      query: {
        one: '001',
        two: '002',
      },
    })

    // baseOptions
    const { data: data1 } = await fexiosWithQueryInit.get<PostmanEcho>('/get')
    expect(data1.args.one).to.equal('001')

    // requestOptions
    const { data: data2 } = await fexios.get<PostmanEcho>('/get', {
      query: {
        one: '111',
      },
    })
    expect(data2.args.one).to.equal('111')

    // requestOptions > urlParams > baseOptions
    const { data: data3 } = await fexiosWithQueryInit.get<PostmanEcho>(
      '/get?two=222',
      {
        query: {
          three: '333',
        },
      }
    )
    expect(data3.args).to.deep.equal({
      one: '001',
      two: '222',
      three: '333',
    })
  })

  it('POST with JSON', async () => {
    const { data } = await fexios.post<PostmanEcho>(
      `${POSTMANECHO_BASE_URL}/post`,
      {
        time,
      }
    )
    expect(data.json.time).to.equal(time)
  })

  it('POST with URLSearchParams', async () => {
    const form = new URLSearchParams()
    const time = '' + Date.now()
    form.append('time', time)
    const { data } = await fexios.post<PostmanEcho>(
      `${POSTMANECHO_BASE_URL}/post`,
      form
    )
    expect(data.form.time).to.equal(time)
  })

  it('POST with FormData', async () => {
    const form = new FormData()
    const time = '' + Date.now()
    form.append('time', time)
    const { data } = await fexios.post<PostmanEcho>(
      `${POSTMANECHO_BASE_URL}/post`,
      form
    )
    expect(data.form.time).to.equal(time)
  })
})

import { describe, expect, it } from 'vitest'
import fexios, {
  Fexios,
  FexiosError,
  FexiosResponseError,
  isFexiosError,
} from '../src/index'
import { EchoResponse } from './MockData'
import { ECHO_BASE_URL } from './constants'

const time = '' + Date.now()

describe('Fexios Core', () => {
  it('Request with full url', async () => {
    const { data } = await fexios.get<EchoResponse>(`${ECHO_BASE_URL}/get`)
    expect(data).to.be.an('object')
  })

  it('Request to absolute path with baseURL', async () => {
    const fexios = new Fexios({
      baseURL: ECHO_BASE_URL,
    })
    const { data } = await fexios.get<EchoResponse>('/path/to/anywhere')
    expect(data.url).to.equal(`${ECHO_BASE_URL}/path/to/anywhere`)
  })

  it('Merge query params', async () => {
    const fexios = new Fexios({
      baseURL: ECHO_BASE_URL,
    })
    const fexiosWithQueryInit = fexios.extends({
      query: {
        one: '001',
        two: '002',
      },
    })

    // baseOptions
    const { data: data1 } = await fexiosWithQueryInit.get<EchoResponse>('')
    expect(data1.searchParams.one).to.equal('001')

    // requestOptions
    const { data: data2 } = await fexios.get<EchoResponse>('/get', {
      query: {
        one: '111',
      },
    })
    expect(data2.searchParams.one).to.equal('111')

    // requestOptions > urlParams > baseOptions
    const { data: data3 } = await fexiosWithQueryInit.get<EchoResponse>(
      '/get?two=222',
      {
        query: {
          three: '333',
        },
      }
    )
    expect(data3.searchParams).to.deep.equal({
      one: '001',
      two: '222',
      three: '333',
    })
  })

  it('GET should not have body', async () => {
    let error: FexiosError | undefined
    try {
      await fexios.get<EchoResponse>(`${ECHO_BASE_URL}/get`, { body: 'test' })
    } catch (e) {
      error = e
    }
    expect(error).to.be.instanceOf(FexiosError)
    expect(isFexiosError(error)).to.be.true
  })

  it('Bad status should throw ResponseError', async () => {
    let error: FexiosResponseError<string> | undefined
    try {
      await fexios.get<EchoResponse>(`${ECHO_BASE_URL}/_status/404`)
    } catch (e) {
      error = e
    }
    expect(error).to.be.instanceOf(FexiosResponseError)
    expect(isFexiosError(error)).to.be.false
    expect(error?.response.data).to.equal(404)
  })

  it('POST with JSON', async () => {
    const { data } = await fexios.post<EchoResponse>(`${ECHO_BASE_URL}/post`, {
      time,
    })
    expect(data.body.time).to.equal(time)
  })

  it('POST with URLSearchParams', async () => {
    const form = new URLSearchParams()
    const time = '' + Date.now()
    form.append('time', time)
    const { data } = await fexios.post<EchoResponse>(
      `${ECHO_BASE_URL}/post`,
      form
    )
    expect(data.formData?.time).to.equal(time)
  })

  it('POST with FormData', async () => {
    const form = new FormData()
    const time = '' + Date.now()
    form.append('time', time)
    const { data } = await fexios.post<EchoResponse>(
      `${ECHO_BASE_URL}/post`,
      form
    )
    expect(data.formData?.time).to.equal(time)
  })
})

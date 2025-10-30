import { describe, expect, it } from 'vitest'
import fexios, { Fexios, FexiosError, FexiosResponseError } from '../src/index'
import { mockFetch, EchoResponse, MOCK_FETCH_BASE_URL } from './mockFetch.js'

const time = '' + Date.now()

Fexios.DEFAULT_CONFIGS.fetch = mockFetch
fexios.baseConfigs.fetch = mockFetch

describe('Fexios Core', () => {
  it('Request with full url', async () => {
    const { data } = await fexios.get<EchoResponse>(
      `${MOCK_FETCH_BASE_URL}/get`
    )
    expect(data).to.be.an('object')
  })

  it('Request to absolute path with baseURL', async () => {
    const fexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
    })
    const { data } = await fexios.get<EchoResponse>('/path/to/anywhere')
    expect(data.url).to.equal(`${MOCK_FETCH_BASE_URL}/path/to/anywhere`)
  })

  it('Pass first argument as options', async () => {
    const { data } = await fexios.request<EchoResponse>({
      url: `${MOCK_FETCH_BASE_URL}/get`,
    })
    expect(data).to.be.an('object')
  })

  it('Merge query params', async () => {
    const fexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
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

  it('Query/Headers Priority: requestOptions > requestURL > defaultOptions > baseURL', async () => {
    // Create fexios with baseURL containing query params and default options
    const testFexios = new Fexios({
      baseURL: `${MOCK_FETCH_BASE_URL}/?source=baseURL&priority=1&keep=base`,
      query: {
        source: 'defaultOptions',
        priority: 2,
        default: 'option',
      },
    })

    const { data } = await testFexios.get<EchoResponse>(
      '/path?source=requestURL&priority=3&url=param',
      {
        query: {
          source: 'requestOptions',
          priority: 4,
          request: 'option',
        },
      }
    )

    // Verify priority: requestOptions wins
    expect(data.searchParams.source).to.equal('requestOptions')
    expect(data.searchParams.priority).to.equal('4')

    // Verify each level contributes unique parameters
    expect(data.searchParams.keep).to.equal('base') // from baseURL
    expect(data.searchParams.default).to.equal('option') // from defaultOptions
    expect(data.searchParams.url).to.equal('param') // from requestURL
    expect(data.searchParams.request).to.equal('option') // from requestOptions
  })

  it('Handle undefined/null query parameters correctly', async () => {
    const testFexios = new Fexios({
      baseURL: MOCK_FETCH_BASE_URL,
    })

    const { data } = await testFexios.get<EchoResponse>('/test', {
      query: {
        keep: 'value',
        empty: '',
        zero: 0,
        falsy: false,
        undef: undefined,
        nullVal: null,
      },
    })

    // Falsy values that are not undefined/null should be kept
    expect(data.searchParams.keep).to.equal('value')
    expect(data.searchParams.empty).to.equal('')
    expect(data.searchParams.zero).to.equal('0')
    expect(data.searchParams.falsy).to.equal('false')

    // undefined and null should be filtered out
    expect(data.searchParams.undef).to.be.undefined
    expect(data.searchParams.nullVal).to.be.undefined
  })

  it('GET should not have body', async () => {
    let error: FexiosError | undefined
    try {
      await fexios.get<EchoResponse>(`${MOCK_FETCH_BASE_URL}/get`, {
        body: 'test',
      })
    } catch (e) {
      error = e as FexiosError
    }
    expect(error).to.be.instanceOf(FexiosError)
    expect(FexiosError.is(error)).to.be.true
  })

  it('Bad status should throw ResponseError', async () => {
    let error: FexiosResponseError<string> | undefined
    try {
      await fexios.get<EchoResponse>(`${MOCK_FETCH_BASE_URL}/_status/404`, {
        fetch: () => Promise.resolve(new Response('404', { status: 404 })),
      })
    } catch (e) {
      error = e as FexiosResponseError<string>
    }
    expect(error).to.be.instanceOf(FexiosResponseError)
    expect(FexiosError.is(error)).to.be.false
    expect(FexiosResponseError.is(error)).to.be.true
    expect(error?.response.data).to.equal('404')
  })

  it('POST with JSON', async () => {
    const { data } = await fexios.post<EchoResponse>(
      `${MOCK_FETCH_BASE_URL}/post`,
      {
        time,
      }
    )
    expect(data.body.time).to.equal(time)
  })

  it('POST with URLSearchParams', async () => {
    const form = new URLSearchParams()
    const time = '' + Date.now()
    form.append('time', time)
    const { data } = await fexios.post<EchoResponse>(
      `${MOCK_FETCH_BASE_URL}/post`,
      form
    )
    expect(data.formData?.time).to.equal(time)
  })

  it('POST with FormData', async () => {
    const form = new FormData()
    const time = '' + Date.now()
    form.append('time', time)
    const { data } = await fexios.post<EchoResponse>(
      `${MOCK_FETCH_BASE_URL}/post`,
      form
    )
    expect(data.formData?.time).to.equal(time)
  })

  it('Callable instance', async () => {
    const { data: data1 } = await fexios<EchoResponse>(
      `${MOCK_FETCH_BASE_URL}/`,
      {
        method: 'POST',
      }
    )
    expect(data1).to.be.an('object')
    expect(data1.method).to.equal('POST')
  })
})

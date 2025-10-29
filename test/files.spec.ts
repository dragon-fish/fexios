import { describe, expect, it } from 'vitest'
import fexios, { Fexios } from '../src/index'
import { File } from '@web-std/file'
import { mockFetch, EchoResponse, MOCK_FETCH_BASE_URL } from './mockFetch.js'

Fexios.DEFAULT_CONFIGS.fetch = mockFetch
fexios.baseConfigs.fetch = mockFetch

// create a fake png file with 1x1 pixel
const imageName = 'test.png'
const imageBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mMAAQAABQABoIJXOQAAAABJRU5ErkJggg=='
const imageDataURL = `data:image/png;base64,${imageBase64}`
const imageFile = dataURLtoFile(imageDataURL, imageName)

function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',')
  const mime = arr[0].match(/:(.*?);/)![1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  // eslint-disable-next-line no-plusplus
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

describe('Fexios Download Binary Files', () => {
  it('GET binary file', async () => {
    const { data } = await fexios.get<Blob>(
      `${MOCK_FETCH_BASE_URL}/_blank.png`,
      {
        responseType: 'blob',
      }
    )
    expect(data).to.be.instanceOf(Blob)
    expect(data.type).to.equal('image/png')
  })
})

describe('Fexios File Uploads', () => {
  it('Upload file directly', async () => {
    const { data } = await fexios.post<EchoResponse>(
      `${MOCK_FETCH_BASE_URL}/post`,
      imageFile
    )

    const fileInfo = data.binaryFiles?.[0]!
    expect(fileInfo).not.to.be.undefined
    expect(fileInfo.type).to.equal('image/png')
    expect(fileInfo.base64).to.equal(imageBase64)
  })

  it('Upload file with Form', async () => {
    const form = new FormData()
    form.append(imageName, imageFile)

    const { data } = await fexios.post<EchoResponse>(
      `${MOCK_FETCH_BASE_URL}/post`,
      form
    )

    expect(data.binaryFiles?.[0]?.name).to.equal(imageName)
  })
})

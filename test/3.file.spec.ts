import fexios from '../src/index'
import { describe, it } from 'mocha'
import { expect } from 'chai'
import { File } from '@web-std/file'
import { HttpBinEcho, PostmanEcho } from './MockData'
import { HTTPBIN_BASE_URL, POSTMANECHO_BASE_URL } from './constants'

// create a fake png file with 1x1 pixel
const fileName = 'test.png'
const fileBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mMAAQAABQABoIJXOQAAAABJRU5ErkJggg=='
const fileDataURL = `data:image/png;base64,${fileBase64}`
const fileFile = dataURLtoFile(fileDataURL, fileName)

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

describe('Fexios File Uploads', () => {
  it('Upload file directly', async () => {
    const { data } = await fexios.post<HttpBinEcho>(
      `${HTTPBIN_BASE_URL}/post`,
      fileFile
    )
    expect(data.data).to.includes(fileDataURL)
  })

  it('Upload file with Form', async () => {
    const form = new FormData()
    form.append(fileName, fileFile)

    const { data } = await fexios.post<PostmanEcho>(
      `${POSTMANECHO_BASE_URL}/post`,
      form
    )

    console.info(data)
    expect(data.files[fileName]).to.includes(fileBase64)
  })
})

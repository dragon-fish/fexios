import fexios from '../src/index'
import { describe, it } from 'mocha'
import { expect } from 'chai'
import { HttpBinEcho } from './MockData'
import { File } from '@web-std/file'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

const fileName = 'blank.png'
const filePath = resolve(__dirname, fileName)

describe('Fexios File Uploads', () => {
  let fileFile: File
  let fileBase64: string

  before(async () => {
    ;[fileFile, fileBase64] = await Promise.all([
      (async () => {
        const file = await readFile(filePath)
        return new File([file], fileName, { type: 'image/png' })
      })(),
      readFile(filePath, 'base64'),
    ])
  })

  it('Upload file directly', async () => {
    const { data } = await fexios.post<HttpBinEcho>(
      'https://httpbin.org/post',
      fileFile
    )

    expect(data.data).to.includes(fileBase64)
  })

  it('Upload file with Form', async () => {
    const form = new FormData()
    form.append('file', fileFile, fileName)

    const { data } = await fexios.post<HttpBinEcho>(
      'https://httpbin.org/post',
      form
    )

    expect(data.files.file).to.equal(`data:image/png;base64,${fileBase64}`)
  })
})

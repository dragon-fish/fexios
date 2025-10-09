import { FetchLike } from '../src/types'

export const MOCK_FETCH_BASE_URL = 'https://fexios.test.fake.url'

export const BLANK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mMAAQAABQABoIJXOQAAAABJRU5ErkJggg=='

const METHODS_WITH_BODY = ['POST', 'PUT', 'PATCH', 'DELETE']

export type EchoResponse = {
  id: string
  method: HTTPMethod
  url: string
  protocol: string
  hostname: string
  port: string
  pathname: string
  search: string
  searchParams: EchoResponseKeyValRecord
  headers: EchoResponseKeyValRecord
  body: any
  formData: EchoResponseKeyValRecord | null
  binaryFiles: EchoResponseFileInfo[]
  _meta: EchoResponseMeta
}

export type HTTPMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS'
  | 'TRACE'

export type EchoResponseKeyValRecord = Record<string, string | string[]>

export type EchoResponseFileInfo = {
  id: string
  name: string
  type: string
  size: number
  dataURL: string
  base64: string
  sha256: string
}

export interface EchoResponseMeta {
  starttime: number
  endtime: number
  duration: number
  bodyType: EchoResponseMetaBodyType
  FORM_DATA_FLAG: string
  BINARY_FILES_FLAG: string
}

export enum EchoResponseMetaBodyType {
  NOT_ACCEPTABLE = 'NOT_ACCEPTABLE',
  JSON = 'JSON',
  TEXT = 'TEXT',
  FORM = 'FORM',
  BINARY = 'BINARY',
  EMPTY = 'EMPTY',
  UNKNOWN = 'UNKNOWN',
}

export const mockFetch: FetchLike = async (
  input: Request | string | URL,
  init?: RequestInit
) => {
  console.info('[mockFetch input]', input, init)
  const req =
    input instanceof Request ? input.clone() : new Request(input, init)
  const url = new URL(req.url)

  // mock blank.png
  if (url.pathname === '/_blank.png') {
    const base64 = BLANK_PNG_BASE64
    const bstr = atob(base64)
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Response(u8arr, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'access-control-allow-origin': '*',
      },
    })
  }

  const starttime = Date.now()
  const id = Math.random().toString(36).substring(2, 15)
  const FORM_DATA_FLAG = new URL(`form-data://${id}/`)
  const BINARY_FILES_FLAG = new URL(`binnary-files://${id}/`)
  const method = req.method as HTTPMethod
  const { values: headers } = await transformKeyValStructure(
    req.headers,
    BINARY_FILES_FLAG
  )
  console.info('[mockFetch Requst]', req)

  let bodyType: EchoResponseMetaBodyType =
    EchoResponseMetaBodyType.NOT_ACCEPTABLE
  let body: any = null
  let formData: Record<string, string | string[]> | null = null
  let contentType = req.headers.get('content-type') || ''
  let binaryFiles: any[] = []

  // Process searchParams
  const { values: searchParams } = await transformKeyValStructure(
    url.searchParams,
    BINARY_FILES_FLAG
  )

  // Handle request body
  if (METHODS_WITH_BODY.includes(method)) {
    // JSON-like
    if (contentType.startsWith('application/json')) {
      bodyType = EchoResponseMetaBodyType.JSON
      body = await req.json()
    }
    // Text-like
    else if (
      contentType.startsWith('text/') ||
      contentType.startsWith('application/javascript') ||
      contentType.startsWith('application/xml') ||
      contentType.startsWith('application/xhtml+xml') ||
      contentType.startsWith('application/rss+xml') ||
      contentType.startsWith('application/atom+xml') ||
      contentType.startsWith('application/svg+xml') ||
      contentType.startsWith('application/x-sh') ||
      contentType.startsWith('application/x-shockwave-flash') ||
      contentType.startsWith('application/ld+json')
    ) {
      bodyType = EchoResponseMetaBodyType.TEXT
      body = (await req.text()) ?? ''
    }
    // FormData or URLSearchParams
    else if (
      contentType.startsWith('multipart/form-data') ||
      contentType.startsWith('application/x-www-form-urlencoded')
    ) {
      bodyType = EchoResponseMetaBodyType.FORM
      const data = await req.formData()
      body = FORM_DATA_FLAG.href
      const { values, files } = await transformKeyValStructure(
        data,
        BINARY_FILES_FLAG
      )
      formData = values
      binaryFiles.push(...files)
    }
    // Blob-like
    else if (
      contentType.startsWith('image/') ||
      contentType.startsWith('video/') ||
      contentType.startsWith('audio/') ||
      contentType.startsWith('application/')
    ) {
      bodyType = EchoResponseMetaBodyType.BINARY
      const buf = await req.arrayBuffer()
      const blob = new Blob([buf], { type: contentType })
      const info = await getFileInfoFromBlob(blob)
      body = new URL(`/${info.id}`, BINARY_FILES_FLAG).href
      binaryFiles.push(info)
    }
    // Unknown
    else {
      body = (await req.text()) ?? null
      bodyType =
        body === null
          ? EchoResponseMetaBodyType.EMPTY
          : EchoResponseMetaBodyType.UNKNOWN
    }
  }

  const endtime = Date.now()

  const responseBody: EchoResponse = {
    id,
    method,
    url: url.href,
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
    search: url.search,
    searchParams,
    headers,
    body,
    formData,
    binaryFiles,
    _meta: {
      starttime,
      endtime,
      duration: endtime - starttime,
      bodyType,
      FORM_DATA_FLAG: FORM_DATA_FLAG.href,
      BINARY_FILES_FLAG: BINARY_FILES_FLAG.href,
    },
  }

  return Response.json(responseBody, {
    status: 200,
    headers: {
      'access-control-allow-origin': '*', // CORS
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

async function transformKeyValStructure(
  form: FormData | URLSearchParams | Headers,
  fileFlag: URL
) {
  const values: Record<string, string | string[]> = {}
  const files: any[] = []

  const insertValue = (key: string, value: string) => {
    if (values[key]) {
      if (Array.isArray(values[key])) {
        ;(values[key] as string[]).push(value)
      } else {
        values[key] = [values[key] as string, value]
      }
    } else {
      values[key] = value
    }
  }

  for (const [key, value] of form.entries()) {
    if (value instanceof Blob) {
      const fileInfo = await getFileInfoFromBlob(value)
      files.push(fileInfo)
      insertValue(key, new URL(`/${fileInfo.id}`, fileFlag).href)
    } else {
      insertValue(key, value)
    }
  }

  return { values, files }
}
async function getFileInfoFromBlob(blob: Blob, maxSize = 1024 * 1024 * 2) {
  const id = Math.random().toString(36).substring(2, 15)
  const isTooLarge = blob.size > maxSize
  const base64 = isTooLarge ? null : await blobToBase64(blob)
  const sha256 = isTooLarge ? null : await blobToSha256(blob)
  // File 对象有 name 属性，Blob 没有
  const name = (blob as any).name || 'unknown'
  return {
    id,
    name,
    size: blob.size,
    type: blob.type,
    base64,
    sha256,
  }
}

function stringToArrayBuffer(str: string) {
  return new TextEncoder().encode(str).buffer
}

async function sha256(data: string | ArrayBuffer | ArrayBufferView) {
  if (typeof data === 'string') {
    data = stringToArrayBuffer(data)
  }
  return crypto.subtle.digest('SHA-256', data as ArrayBuffer).then((buf) =>
    Array.from(new Uint8Array(buf))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  )
}

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function blobToSha256(blob: Blob) {
  const buffer = await blob.arrayBuffer()
  return sha256(buffer)
}

async function readBody<T extends unknown = any>(
  body: ReadableStream
): Promise<T | undefined> {
  if (!body) return undefined
  const reader = body.getReader()
  const result = await reader.read()
  return result.value
}

async function readFormData(body: ReadableStream) {
  return readBody<FormData | URLSearchParams>(body)
}

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

export type EchoResponseKeyValRecord = Record<string, string | string[]>

export type EchoResponseFileInfo = {
  id: string
  name: string
  type: string
  size: number
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
  [key: string]: any
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

export type HTTPMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS'
  | 'CONNECT'
  | 'TRACE'

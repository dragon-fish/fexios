export type EchoResponse = {
  uuid: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  url: string
  protocol: string
  pathname: string
  origin: string
  hostname: string
  searchParams: Record<string, string>
  headers: Record<string, string>
  body: any
  formData?: Record<string, string>
  binaryFiles: EchoResponseFileInfo[]
}

export type EchoResponseFileInfo = {
  uuid: string
  name: string
  type: string
  size: number
  dataURL: string
}

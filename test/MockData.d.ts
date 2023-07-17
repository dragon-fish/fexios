export type Todo = {
  userId: number
  id: number
  title: string
  completed: boolean
}

export type Post = {
  userId: number
  id: number
  title: string
  body: string
}

export type Comment = {
  postId: number
  id: number
  name: string
  email: string
  body: string
}

export type PostmanEcho = {
  args: Record<string, string>
  data: string
  files: Record<string, string>
  form: Record<string, string>
  headers: Record<string, string>
  json: any | null
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  origin: string
  url: string
}

export type HttpBinEcho = {
  args: Record<string, string[]>
  data: string
  files: Record<string, string[]>
  form: Record<string, string[]>
  headers: Record<string, string[]>
  json: any | null
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  origin: string
  url: string
}

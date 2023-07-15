<div align="center">

# Fexios

类 Axios 语法的原生 fetch API 请求封装库<br>
Fetch based HTTP client with similar API to axios for browser and Node.js

~~fetch + axios = fexios~~ (Just a joke)

</div>

## 特色功能 Features

- [x] Native fetch API (supports the Promise API)
- [x] Hookable (intercept request and response)
- [x] Automatic transform request and response data
- [x] Automatic transforms for JSON data
- [x] Instance extendable

## 安装/Installation

**包管理器/Using package manager**

```sh
# Node Package Manager
npm install fexios
# Why not pnpm
pnpm add fexios
# Or yarn?
yarn add fexios
```

Then import the library and enjoy:

```ts
import fexios, { createFexios, Fexios } from 'fexios'

// Using directly
fexios.get('https://zh.moegirl.org.cn/api.php')

// With options
const fexios = createFexios(/* options */)
const fexios = new Fexios(/* options */)
const fexios = Fexios.create(/* options */)
```

**在浏览器中直接使用/Use directly in the browser**

- JS Module

```ts
import('https://unpkg.com/fexios?module').then(({ createFexios }) => {
  const fexios = createFexios(/* options */)
})
```

- Global variables

```html
<script src="https://unpkg.com/fexios"></script>

<script>
  // Using directly
  fexios.get('https://zh.moegirl.org.cn/api.php')

  // With options
  const { createFexios } = Fexios
  const fexios = createFexios(/* options */)
</script>
```

## 使用方法/Usage

You can find some sample code snippets [here](test/).

### new Fexios(configs: Partial\<FexiosConfigs>)

<details>

<summary>FexiosConfigs</summary>

```ts
export type FexiosConfigs = {
  baseURL: string
  query: Record<string, string | number | boolean> | URLSearchParams
  headers: Record<string, string> | Headers
  credentials: 'omit' | 'same-origin' | 'include'
  responseType: 'json' | 'blob' | 'text'
}
```

</details>

<details>

<summary>Defaults</summary>

```ts
const DEFAULT_CONFIGS = {
  baseURL: '',
  credentials: 'same-origin',
  headers: {
    'content-type': 'application/json; charset=UTF-8',
  },
  query: {},
  responseType: 'json',
}
```

</details>

### Fexios#request(config: FexiosRequestOptions)

`fexios.request<T>(config): Promise<FexiosResponse<T>>`

<details>

<summary>FexiosRequestOptions</summary>

```ts
export interface FexiosRequestOptions {
  baseURL?: string
  method?: FexiosMethods
  credentials?: 'omit' | 'same-origin' | 'include'
  headers?: Record<string, string> | Headers
  query?: Record<string, string | number | boolean> | URLSearchParams
  body?: Record<string, any> | string | FormData | URLSearchParams
  responseType?: 'json' | 'blob' | 'text'
}
```

</details>

**Response**

```ts
export type FexiosResponse<T = any> = {
  rawRequest: Request
  rawResponse: Response
  ok: boolean
  status: number
  statusText: string
  headers: Headers
  isGood: boolean
  data: T
}
```

And common request methods aliases:

- fexios.get(url[, config])
- fexios.delete(url[, config])
- fexios.head(url[, config])
- fexios.options(url[, config])
- fexios.post(url[, data[, config]])
- fexios.put(url[, data[, config]])
- fexios.patch(url[, data[, config]])

## Hooks

```ts
export interface FexiosContext<T = any> extends FexiosRequestOptions {
  url: string // may changes after beforeInit
  rawRequest?: Request // provide in beforeRequest
  rawResponse?: Response // provide in afterRequest
  response?: FexiosResponse // provide in afterRequest
  data?: T // provide in afterRequest
}
export type FexiosHook<C = unknown> = (context: C) => AwaitAble<C | false>
export type FexiosEvents = 'beforeInit' | 'beforeRequest' | 'afterResponse'
```

### beforeInit

### beforeRequest

### afterRequest

You can modify context in hooks' callback then return it as brand new context™.

Return `false` to abort request immediately.

<details>

<summary>Hooks example</summary>

```ts
const fexios = new Fexios()

fexios.on('beforeRequest', async (ctx) => {
  if (new URL(ctx.url).path === '/foo') {
    return false
  } else {
    ctx.query.foo = 'bar'
  }
  return ctx
})
```

</details>

---

> MIT License
>
> Copyright (c) 2023 机智的小鱼君 (A.K.A. Dragon-Fish)

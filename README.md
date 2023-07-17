<div align="center">

# Fexios

类 Axios 语法的原生 fetch API 请求封装库<br>
Fetch based HTTP client with similar API to axios for browser and Node.js

~~fetch + axios = fexios~~ (Just a joke)

</div>

## 特色功能 Features

- [x] 🤯 Native fetch API (supports the Promise API)
- [x] 🤫 Method shortcuts (`fexios.post()`)
- [x] 🔗 Hooks (intercept request and response)
- [x] 😏 Automatic transform request and response data
- [x] 😏 Automatic transforms for JSON data
- [x] 🤩 Instances with custom defaults
- [x] 🫡 Instance extendable
- [x] 😍 Fricking tiny size: `index.umd.js  5.00 kB │ gzip: 2.13 kB │ map: 19.03 kB`

## 安装 Installation

**包管理器 Using package manager**

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

**在浏览器中直接使用 Use directly in the browser**

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

## 兼容性 Compatibility

Refer: https://developer.mozilla.org/docs/Web/API/Fetch_API

| Chrome | Edge | Firefox | Opera | Safari          | Node.js                |
| ------ | ---- | ------- | ----- | --------------- | ---------------------- |
| 42     | 14   | 39      | 29    | 10.1 (iOS 10.3) | ^16.15.0 \|\| >=18.0.0 |

\* Abort signal requires higher version.

## 使用方法 Usage

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

**returns {FexiosFinalContext}**

```ts
export type FexiosFinalContext<T = any> = Omit<
  FexiosContext<T>,
  'rawResponse' | 'response' | 'data' | 'headers'
> & {
  rawResponse: Response
  response: FexiosResponse<T>
  headers: Headers
  data: T
}
export type FexiosResponse<T = any> = {
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

## 钩子 Hooks

You can modify context in hooks' callback then return it as a brand new context™.

Return `false` to abort request immediately.

```ts
export type FexiosHook<C = unknown> = (context: C) => AwaitAble<C | false>
export interface FexiosContext<T = any> extends FexiosRequestOptions {
  url: string // may changes after beforeInit
  rawRequest?: Request // provide in beforeRequest
  rawResponse?: Response // provide in afterRequest
  response?: FexiosResponse // provide in afterRequest
  data?: T // provide in afterRequest
}
```

<details>

<summary>Hooks example</summary>

```ts
const fexios = new Fexios()

fexios.on('beforeRequest', async (ctx) => {
  const url = new URL(ctx.url)
  if (url.searchParams.has('foo')) {
    return false
  } else {
    url.searchParams.set('foo', 'bar')
    ctx.url = '' + url
    return ctx
  }
})
```

</details>

### beforeInit

All context passed as is. You can do custom conversions here.

### beforeRequest

Pre-converted done.

At this time, `ctx.url` has been converted to final URL string. You cannot modify the `ctx.query` or `ctx.baseURL` to change `ctx.url`. Please modify `ctx.url` directly.

- `ctx.url` `{string}` full URL string converted from url, baseURL and ctx.query
- `ctx.query` `{Record<string, string>}` merged from url, requestOptions, baseOptions
- `ctx.headers` `{Record<string, string>}` merged from requestOptions, baseOptions

### afterBodyTransformed

JSON body has been transformed to JSON string. `Content-Type` header has been set to body's type.

- `ctx.body` `{string|URLSearchParams|FormData|Blob}`

### beforeActualFetch

The Request instance has been generated.

At this time, you cannot modify the `ctx.url`, `ctx.query`, `ctx.headers` or `ctx.body` (etc.) anymore. Unless you pass a brand new `Request` to replace `ctx.rawRequest`.

- `ctx.rawRequest` `{Request}`

### afterResponse

The `FexiosFinalContext` will be passed

### interceptors

Oh, this is mimicked from axios. Just sweet sugar.

<!-- prettier-ignore-start -->
```ts
// They are the same
fexios.on('beforeRequest', async (ctx) => {})
fexios.interceptors.request.use((ctx) =>  {})

// Bro, they're just the same
fexios.on('afterResponse', async (ctx) => {})
fexios.interceptors.response.use((ctx) => {})
```
<!-- prettier-ignore-end -->

---

> MIT License
>
> Copyright (c) 2023 机智的小鱼君 (A.K.A. Dragon-Fish)

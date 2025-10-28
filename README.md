<div align="center">

# Fexios

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios?ref=badge_shield)

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
- [x] 😍 Fricking tiny size: `index.umd.cjs  8.51 kB │ gzip: 3.48 kB │ map: 31.96 kB`

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
export interface FexiosConfigs {
  baseURL: string
  timeout: number
  /**
   * In context, query value can be:
   * - `null`      - to remove the item
   * - `undefined` - to keep the item as is
   */
  query: Record<string, any> | URLSearchParams
  headers: Record<string, string | string[]> | Headers
  credentials?: RequestInit['credentials']
  cache?: RequestInit['cache']
  mode?: RequestInit['mode']
  responseType?: 'json' | 'blob' | 'text' | 'stream' | 'arrayBuffer'
  fetch?: FetchLike
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
  fetch: globalThis.fetch,
}
```

</details>

### Fexios#request(config: FexiosRequestOptions)

`fexios.request<T>(config): Promise<FexiosResponse<T>>`

<details>

<summary>FexiosRequestOptions</summary>

```ts
export interface FexiosRequestOptions extends Omit<FexiosConfigs, 'headers'> {
  url?: string | URL
  method?: FexiosMethods
  /**
   * In context, header value can be:
   * - `null`      - to remove the header
   * - `undefined` - to keep the header as is
   */
  headers: Record<string, string | string[] | null | undefined> | Headers
  body?: Record<string, any> | string | FormData | URLSearchParams
  abortController?: AbortController
  onProgress?: (progress: number, buffer?: Uint8Array) => void
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
  response: IFexiosResponse<T>
  headers: Headers
  data: T
}
export interface IFexiosResponse<T = any> {
  ok: boolean
  status: number
  statusText: string
  headers: Headers
  rawResponse: Response
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

## 请求参数合并规则 Queries/Headers Merge Strategy

- `ctx.query` could be: `Record<string, any> | URLSearchParams`
- `ctx.headers` could be: `Record<string, string | string[] | null | undefined> | Headers`

Basic merging rules:

1. `undefined` value will keep the item as is
2. `null` value will remove the item
3. For other values: new value will override the old one

See [header-builder.spec.ts](src/models/header-builder.spec.ts) and [query-builder.spec.ts](src/models/query-builder.spec.ts) for more examples.

## 钩子 Hooks

You can modify context in hooks' callback then return it as a brand new context™.

Return `false` to abort request immediately.

```ts
export type FexiosHook<C = unknown> = (
  context: C
) => AwaitAble<C | void | false>
export interface FexiosContext<T = any> extends FexiosRequestOptions {
  url: string // may changes after beforeInit
  rawRequest?: Request // provide in beforeRequest
  rawResponse?: Response // provide in afterRequest
  response?: IFexiosResponse // provide in afterRequest
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

## License

> MIT License
>
> Copyright (c) 2023 机智的小鱼君 (A.K.A. Dragon-Fish)

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios?ref=badge_large)

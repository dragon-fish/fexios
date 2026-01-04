<div align="center">

# Fexios

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios?ref=badge_shield)

Fetch based HTTP client with similar API to axios for browser and Node.js

~~fetch + axios = fexios~~ (Just a joke)

</div>

[简体中文](README.zh_CN.md) | [English](README.md)

## Features

- [x] 🤯 Native fetch API (supports the Promise API)
- [x] 🤫 Method shortcuts (`fexios.post()`)
- [x] 🔗 Hooks (intercept request and response)
- [x] 😏 Automatic transform request and response data
- [x] 😏 Automatic transforms for JSON data
- [x] 🤩 Instances with custom defaults
- [x] 🫡 Instance extendable
- [x] 😍 Fricking tiny size: ~6kb (gzipped)

## Installation

**Using package manager**

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
// Using directly
import fexios from 'fexios'
fexios.get('https://zh.moegirl.org.cn/api.php')
// Yes, it's callable! Just like axios
fexios({
  url: 'https://zh.moegirl.org.cn/api.php',
  method: 'GET',
})
fexios('https://zh.moegirl.org.cn/api.php', {
  method: 'POST',
  body: { foo: 'bar' },
})

// Customize instance
import { createFexios, Fexios } from 'fexios'
const fexios = createFexios(/* options */)
const fexios = new Fexios(/* options */)
const fexios = Fexios.create(/* options */)
// Custom instance is also callable
fexios('https://zh.moegirl.org.cn/api.php', {
  method: 'POST',
  body: { foo: 'bar' },
})
```

**Use directly in the browser**

- ES Module

```ts
import('https://unpkg.com/fexios?module').then(({ createFexios }) => {
  const fexios = createFexios(/* options */)
})
```

- UMD bundle

```html
<script src="https://unpkg.com/fexios/lib/index.js"></script>

<script>
  // Using directly
  const { fexios } = window.Fexios
  fexios.get('https://zh.moegirl.org.cn/api.php')

  // With options
  const { createFexios } = window.Fexios
  const fexios = createFexios(/* options */)
</script>
```

## Compatibility

Refer: https://developer.mozilla.org/docs/Web/API/Fetch_API

| Chrome | Edge | Firefox | Opera | Safari          | Node.js                |
| ------ | ---- | ------- | ----- | --------------- | ---------------------- |
| 42     | 14   | 39      | 29    | 10.1 (iOS 10.3) | ^16.15.0 \|\| >=18.0.0 |

\* Abort signal requires higher version.

## Usage

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

## Automatic Merge for Queries/Headers

The url/query/headers parameters you pass in various places will be automatically merged to build the complete request.

### Merge Strategy

Fexios uses a simplified 2-stage merge strategy:

#### 1. Apply Defaults (After `beforeInit`)

This happens only ONCE, immediately after the `beforeInit` hook.

- **URL**: `ctx.url` is resolved against `defaults.baseURL`.
  - Search params from `defaults.baseURL` are merged into `ctx.url`.
  - Priority: `ctx.url` search params > `defaults.baseURL` search params.
- **Query**: `defaults.query` is merged into `ctx.query`.
  - Priority: `ctx.query` > `defaults.query`.
- **Headers**: `defaults.headers` is merged into `ctx.headers`.
  - Priority: `ctx.headers` > `defaults.headers`.

#### 2. Finalize Request (Before `beforeActualFetch`)

This happens when constructing the native `Request` object.

- **Query**: `ctx.query` is merged into the final URL's search params.
  - Priority: `ctx.query` > URL search params (from step 1 or modified by hooks).
- **Headers**: Final headers are built.

### Merge Rules

- **undefined**: Keeps the value from the lower layer (or no change).
- **null**: Removes the key from the result.
- **value**: Overwrites the lower layer.

### Note on Hooks

- Modifications to `ctx.url` in hooks (e.g. `beforeRequest`) will **NOT** be parsed into `ctx.query`. They are treated as separate entities until the final merge.
- If you replace `ctx.url` in a hook, you lose the original URL search params unless you manually preserve them.
- To modify query parameters reliably in hooks, prefer operating on `ctx.query`.

## Hooks

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
  ctx.headers.authorization = localStorage.getItem('token')
  if (ctx.query.foo === 'bar') {
    return false
  } else {
    ctx.query.foo = 'baz'
    return ctx
  }
  return ctx
})
```

</details>

### beforeInit

All context passed as is. You can do custom conversions here.

### beforeRequest

Pre-converted done.

### afterBodyTransformed

- `ctx.body`: `{string|URLSearchParams|FormData|Blob}` now available.

JSON body has been transformed to JSON string. `Content-Type` header has been set to body's type.

### beforeActualFetch

- `ctx.rawRequest`: `{Request}` now available.

The Request instance has been generated.

At this time, you cannot modify the `ctx.url`, `ctx.query`, `ctx.headers` or `ctx.body` (etc.) anymore. Unless you pass a brand new `Request` to replace `ctx.rawRequest`.

### afterResponse

Anything will be read-only at this time.

ctx is `FexiosFinalContext` now.

### Short-circuit Response

A hook callback can also return a `Response` at any time to short-circuit the request flow; Fexios will treat it as the final response and proceed to `afterResponse`:

```ts
fx.on('beforeActualFetch', () => {
  return new Response(JSON.stringify({ ok: 1 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
})
```

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

## Plugin

```ts
import { Fexios, type FexiosPlugin } from 'fexios'

const authPlugin: FexiosPlugin = {
  name: 'auth-plugin',
  install(fx) {
    fx.on('beforeRequest', (ctx) => {
      ctx.headers = { ...ctx.headers, Authorization: 'Bearer token' }
      return ctx
    })
  },
}

const fx = new Fexios()
await fx.plugin(authPlugin)
```

### Official plugins

See the plugin docs index: [`docs/plugins/README.md`](docs/plugins/README.md)

- Cookie Jar: [`docs/plugins/cookie-jar.md`](docs/plugins/cookie-jar.md)
- SSE (EventSource): [`docs/plugins/sse.md`](docs/plugins/sse.md)
- WebSocket: [`docs/plugins/websocket.md`](docs/plugins/websocket.md)

---

## License

> MIT License
>
> Copyright (c) 2023 机智的小鱼君 (A.K.A. Dragon-Fish)

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios?ref=badge_large)

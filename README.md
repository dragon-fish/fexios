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
- [x] 😍 Fricking tiny size: `index.umd.cjs  8.51 kB │ gzip: 3.48 kB │ map: 31.96 kB`

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
import fexios, { createFexios, Fexios } from 'fexios'

// Using directly
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

// With options
const fexios = createFexios(/* options */)
const fexios = new Fexios(/* options */)
const fexios = Fexios.create(/* options */)
```

**Use directly in the browser**

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

The url/query/headers parameters you pass in various places, as well as parameters modified in hook callbacks, will be automatically merged in order and according to the following rules to build the complete request URL and request headers.

### Context Overwriting Rules

- `ctx.query` could be: `Record<string, any> | URLSearchParams`
- `ctx.headers` could be: `Record<string, string | string[] | null | undefined> | Headers`

Basic merging rules:

1. `undefined` value means no change for that key (keep from lower layer)
2. `null` value means remove that key (delete, regardless of lower layer)
3. Other values: overwrite with the new value

Details:

- Queries
  - Accepts `Record<string, any>` or `URLSearchParams` (internally supports conversion from `string`/`FormData`/`Map` etc. to objects for merging).
  - Arrays are expanded as duplicate keys; if the key name ends with `[]` (e.g., `'tags[]'`), it is forced to output with the `[]` suffix.
  - Nested objects are expanded as `a[b][c]=...`; `undefined` preserves the lower layer value, `null` completely removes the key.
- Headers
  - Case-insensitive, internally processed according to `Headers` semantics.
  - `string[]` first deletes the original value and then appends each item; `undefined` preserves, `null` deletes, normal values use set to overwrite.
  - Automatic content type: When `content-type` is not explicitly specified, JSON object bodies are serialized and set to `application/json`; `FormData`/`URLSearchParams` let the runtime set it automatically (equivalent to setting the key to `null`).

See [header-builder.spec.ts](src/models/header-builder.spec.ts) and [query-builder.spec.ts](src/models/query-builder.spec.ts) for more examples.

### Merge Priority

For easier understanding, the following describes "layers" from high to low; high layers can override low layers, `undefined` means "keep the lower layer value", `null` means "remove from the final result".

- Without hooks (first normalization)

  - Query: `ctx.query` (request options) > `ctx.url` (request URL's search part) > `baseConfigs.query` > `baseURL`'s search
  - Headers: `request options.headers` > `baseConfigs.headers`

- With hooks (normalization after hooks)
  - Query: `ctx.query` (modified by hooks) > `ctx.url` (modified URL's search by hooks) > original request URL's search (before hooks) > `baseConfigs.query` > `baseURL`'s search
  - Headers: `ctx.headers` (modified by hooks) > `request options.headers` > `baseConfigs.headers`

Additional rules (consistent with unit tests):

- If a key is set to `undefined` in hooks, the same key will not be overwritten by the "request URL layer" and will retain the lower layer value (usually the base layer).
- If a key is set to `null`, it will be removed from the final result regardless of whether it exists in lower layers.

Example:

```text
base: keep=baseKeep
request URL: keep=reqKeep
hook: ctx.query.keep = undefined
=> result keep=baseKeep (request URL ignored, base retained)

base: rm=baseRemove
hook: ctx.query.rm = null
=> result rm removed
```

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
import type { FexiosPlugin } from 'fexios'

const authPlugin: FexiosPlugin = (app) => {
  app.on('beforeRequest', (ctx) => {
    ctx.headers = { ...ctx.headers, Authorization: 'Bearer token' }
    return ctx
  })
  return app // You can return app, or omit the return value
}

const fx = new Fexios().plugin(authPlugin)
```

---

## License

> MIT License
>
> Copyright (c) 2023 机智的小鱼君 (A.K.A. Dragon-Fish)

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios?ref=badge_large)

<div align="center">

# Fexios

<img src="docs/logos/fexios-logo-horizontal.png" alt="Fexios Logo" width="200">

[![npm version](https://img.shields.io/npm/v/fexios)](https://www.npmjs.com/package/fexios)
[![npm downloads](https://img.shields.io/npm/dm/fexios)](https://www.npmjs.com/package/fexios)
[![Unit test](https://github.com/dragon-fish/fexios/actions/workflows/unit-test.yml/badge.svg)](https://github.com/dragon-fish/fexios/actions/workflows/unit-test.yml)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios?ref=badge_shield)

类 Axios 语法的原生 fetch API 请求封装库

~~fetch + axios = fexios~~ (神金)

</div>

[简体中文](README.zh_CN.md) | [English](README.md)

## 特色功能

- [x] 🤯 Native fetch API (supports the Promise API)
- [x] 🤫 Method shortcuts (`fexios.post()`)
- [x] 🔗 Hooks (intercept request and response)
- [x] 😏 Automatic transform request and response data
- [x] 😏 Automatic transforms for JSON data
- [x] 🤩 Instances with custom defaults
- [x] 🫡 Instance extendable
- [x] 😍 Fricking tiny size: `index.umd.cjs  8.51 kB │ gzip: 3.48 kB │ map: 31.96 kB`

## 安装

**包管理器**

```sh
# Node Package Manager
npm install fexios
# Why not pnpm
pnpm add fexios
# Or yarn?
yarn add fexios
```

然后导入库并开始使用：

```ts
import fexios, { createFexios, Fexios } from 'fexios'

// 直接使用
fexios.get('https://zh.moegirl.org.cn/api.php')

// 带配置项使用
const fexios = createFexios(/* options */)
const fexios = new Fexios(/* options */)
const fexios = Fexios.create(/* options */)
```

**在浏览器中直接使用**

- JS Module

```ts
import('https://unpkg.com/fexios?module').then(({ createFexios }) => {
  const fexios = createFexios(/* options */)
})
```

- 全局变量

```html
<script src="https://unpkg.com/fexios"></script>

<script>
  // 直接使用
  fexios.get('https://zh.moegirl.org.cn/api.php')

  // 带配置项使用
  const { createFexios } = Fexios
  const fexios = createFexios(/* options */)
</script>
```

## 兼容性

参考：https://developer.mozilla.org/docs/Web/API/Fetch_API

| Chrome | Edge | Firefox | Opera | Safari          | Node.js                |
| ------ | ---- | ------- | ----- | --------------- | ---------------------- |
| 42     | 14   | 39      | 29    | 10.1 (iOS 10.3) | ^16.15.0 \|\| >=18.0.0 |

\* Abort signal 需要更高版本。

## 使用方法

你可以在[这里](test/)找到一些示例代码片段。

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
  responseType?: 'json' | 'text' | 'form' | 'blob' | 'arrayBuffer'
  fetch?: FetchLike
}
```

</details>

<details>

<summary>默认配置</summary>

```ts
const DEFAULT_CONFIGS = {
  baseURL: '',
  timeout: 0,
  credentials: undefined,
  headers: {},
  query: {},
  responseType: undefined,
  shouldThrow(response) {
    return !response.ok
  },
  fetch: globalThis.fetch,
}
```

</details>

### Fexios#request(config: FexiosRequestOptions)

`timeout` 为正数时，以毫秒为单位限制从发起 fetch 到响应正文解析完成的时间。设为 `0` 可关闭超时。超时抛出 `TIMEOUT`，且只影响当前请求。多个请求可共用一个 `abortController`，由调用方统一取消。主动取消抛出 `ABORTED`，取消原因保存在 `error.cause`。

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

**返回 {FexiosFinalContext}**

```ts
export type FexiosFinalContext<T = any> = {
  request: {
    url: string
    method?: string
    headers: Headers | Record<string, any>
    query: Record<string, any> | URLSearchParams
    body?: any
    rawRequest: Request
    // ... 其他请求配置 ...
  }
  runtime: {
    abortController?: AbortController
    onProgress?: (progress: number, buffer?: Uint8Array) => void
    customEnv?: any
  }
  /** 解析后的响应包装对象 */
  response: IFexiosResponse<T>
  /** 未读取的原始 Response */
  rawResponse: Response
  /** 常用快捷 getter */
  readonly headers: Headers
  readonly data: T
  readonly responseType: 'json' | 'text' | 'form' | 'blob' | 'arrayBuffer'
  readonly url: string
  readonly rawRequest: Request
}
export interface IFexiosResponse<T = any> {
  ok: boolean
  status: number
  statusText: string
  headers: Headers
  rawResponse: Response
  data: T
  responseType: 'json' | 'text' | 'form' | 'blob' | 'arrayBuffer'
}
```

以及常用的请求方法别名：

- fexios.get(url[, config])
- fexios.delete(url[, config])
- fexios.head(url[, config])
- fexios.options(url[, config])
- fexios.post(url[, data[, config]])
- fexios.put(url[, data[, config]])
- fexios.patch(url[, data[, config]])

## 请求参数自动合并

你在各处传入的 url/query/headers 参数，将会被按以下策略自动合并，以构建最终的请求。

### 合并策略

Fexios 采用简化的两阶段合并策略：

#### 1. 应用默认配置（Apply Defaults）

此步骤仅在 `beforeInit` 钩子之后执行**一次**。

- **URL**: 将 `ctx.request.url` 基于 `defaults.baseURL` 解析为完整路径。
  - `defaults.baseURL` 中的 search params 会合并入 `ctx.request.url`。
  - 优先级：`ctx.request.url` search params > `defaults.baseURL` search params。
- **Query**: `defaults.query` 合并入 `ctx.request.query`。
  - 优先级：`ctx.request.query` > `defaults.query`。
- **Headers**: `defaults.headers` 合并入 `ctx.request.headers`。
  - 优先级：`ctx.request.headers` > `defaults.headers`。

#### 2. 生成最终请求（Finalize Request）

此步骤在构建原生 `Request` 对象前（即 `beforeActualFetch` 之前）执行。

- **Query**: 将 `ctx.request.query` 合并入最终 URL 的 search params。
  - 优先级：`ctx.request.query` > URL search params（来自第一步或被钩子修改后的 URL）。
- **Headers**: 构建最终的 Headers 对象。

### 合并规则

- **undefined**: 保留低层值（即无变化）。
- **null**: 删除该键。
- **其他值**: 覆盖低层值。

### 钩子注意事项

- 在钩子（如 `beforeRequest`）中修改 `ctx.request.url` **不会**被解析回 `ctx.request.query`。它们在最终合并前是相互独立的实体。
- 如果你在钩子中替换了 `ctx.request.url`，除非你手动保留，否则原 URL 中的 search params 将会丢失。
- 如需在钩子中修改查询参数，建议直接操作 `ctx.request.query`。

## 钩子

你可以在钩子回调中修改上下文，然后将其作为全新的上下文 ™ 返回。

- 返回 `false` 立即中止请求。
- 返回 `Response` 或 `FexiosResponse` 对象以短路请求（跳过实际网络请求）。
- 返回 `Promise<FexiosFinalContext>`（例如来自另一个 `fx.request()`）以替换当前请求流程。

```ts
export type FexiosHook<C = unknown> = (
  context: C
) => AwaitAble<
  C | void | false | Response | FexiosResponse | FexiosFinalContext
>
export interface FexiosContext<T = any> {
  request: {
    url: string // 可能在 beforeInit 后发生变化
    query: Record<string, any> | URLSearchParams
    headers: Headers | Record<string, any>
    body?: any
    rawRequest?: Request // 在 beforeActualFetch 中可用
  }
  runtime: {
    abortController?: AbortController
    customEnv?: any
  }
  rawResponse?: Response // 在 afterRawResponse 中可用
  response?: IFexiosResponse<T> // 在 afterResponse 中可用
  // NOTE: 旧字段如 ctx.url / ctx.query 可能仍存在，但已 deprecated。
}
```

<details>

<summary>钩子示例</summary>

```ts
const fexios = new Fexios()

fexios.on('beforeRequest', async (ctx) => {
  ;(ctx.request.headers as any).authorization = localStorage.getItem('token')
  const q = ctx.request.query as any
  if (q.foo === 'bar') {
    return false
  } else {
    q.foo = 'baz'
    return ctx
  }
  return ctx
})
```

</details>

### beforeInit

所有上下文按原样传递。你可以在此处进行自定义转换。

### beforeRequest

预转换已完成。

### afterBodyTransformed

- `ctx.body`: `{string|URLSearchParams|FormData|Blob}` 现在可用。

JSON 主体已转换为 JSON 字符串。`Content-Type` 头已设置为主体的类型。

### beforeActualFetch

- `ctx.request.rawRequest`: `{Request}` 现在可用。

Request 实例已生成。

此时，你不能再修改 `ctx.request.url`、`ctx.request.query`、`ctx.request.headers` 或 `ctx.request.body`（等）。除非你传递一个全新的 `Request` 来替换 `ctx.request.rawRequest`。

### afterResponse

此时所有内容都是只读的。

ctx 现在是 `FexiosFinalContext`。

### 短路响应

钩子回调还可以随时返回一个 `Response` 来短路请求流程，Fexios 会将其判定为最终响应并进入 `afterResponse`：

```ts
fx.on('beforeActualFetch', () => {
  return new Response(JSON.stringify({ ok: 1 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
})
```

### 拦截器

好吧，这部分只是为了模仿 axios，它们只是齁甜的语法糖。

<!-- prettier-ignore-start -->
```ts
// 这俩其实一个意思
fexios.on('beforeRequest', async (ctx) => {})
fexios.interceptors.request.use((ctx) =>  {})

// 🦐 对的，完全一样
fexios.on('afterResponse', async (ctx) => {})
fexios.interceptors.response.use((ctx) => {})
```
<!-- prettier-ignore-end -->

## 插件

插件文档主目录：[`docs/plugins/README.md`](docs/plugins/README.md)

官方插件：

- Cookie Jar：[`docs/plugins/cookie-jar.md`](docs/plugins/cookie-jar.md)
- SSE (EventSource)：[`docs/plugins/sse.md`](docs/plugins/sse.md)
- WebSocket：[`docs/plugins/websocket.md`](docs/plugins/websocket.md)
- ……也许会有更多？

---

## 许可证

> MIT License
>
> Copyright (c) 2023 机智的小鱼君 (A.K.A. Dragon-Fish)

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios?ref=badge_large)

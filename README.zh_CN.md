<div align="center">

# Fexios

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
  responseType?: 'json' | 'blob' | 'text' | 'stream' | 'arrayBuffer'
  fetch?: FetchLike
}
```

</details>

<details>

<summary>默认配置</summary>

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

**返回 {FexiosFinalContext}**

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

以及常用的请求方法别名：

- fexios.get(url[, config])
- fexios.delete(url[, config])
- fexios.head(url[, config])
- fexios.options(url[, config])
- fexios.post(url[, data[, config]])
- fexios.put(url[, data[, config]])
- fexios.patch(url[, data[, config]])

## 请求参数自动合并

你在各处传入的 url/query/headers 参数，以及钩子回调中修改的参数，都会被按顺序、并按以下规则自动合并，最终构建出完整的请求 URL 和请求头。

### 上下文覆写规则

- `ctx.query` 可以是：`Record<string, any> | URLSearchParams`
- `ctx.headers` 可以是：`Record<string, string | string[] | null | undefined> | Headers`

基本合并规则：

1. `undefined` 值表示该键无变化（保留下层值）
2. `null` 值表示移除该键（删除，无视下层）
3. 其他值：用新值覆盖

详细信息：

- 查询参数
  - 接受 `Record<string, any>` 或 `URLSearchParams`（内部合并同时支持 `string`/`FormData`/`Map` 等转为对象后处理）。
  - 数组会展开为重复键；若键名以 `[]` 结尾（如 `'tags[]'`），则强制以带 `[]` 的键输出。
  - 嵌套对象会展开为 `a[b][c]=...` 的形式；`undefined` 会保留下层值，`null` 会彻底移除该键。
- 请求头
  - 大小写不敏感，内部统一按 `Headers` 语义处理。
  - `string[]` 会先删除原值再逐一 append；`undefined` 保留，`null` 删除，普通值使用 set 覆盖。
  - 自动内容类型：在未显式指定 `content-type` 时，JSON 对象体会被序列化并设置为 `application/json`；`FormData`/`URLSearchParams` 让运行时自行设置（等同于将该键置 `null`）。

更多示例请参阅 [header-builder.spec.ts](src/models/header-builder.spec.ts) 和 [query-builder.spec.ts](src/models/query-builder.spec.ts)。

### 合并优先级

为便于理解，下文把"层"从高到低描述；高层可覆盖低层，`undefined` 表示"保留低层值"，`null` 表示"从最终结果中移除"。

- 无 hooks（首次归一化）

  - Query: `ctx.query`（请求选项） > `ctx.url`（请求 URL 的 search 部分） > `baseConfigs.query` > `baseURL` 的 search
  - Headers: `request options.headers` > `baseConfigs.headers`

- 有 hooks（hooks 之后的归一化）
  - Query: `ctx.query`（已被 hooks 修改） > `ctx.url`（已被 hooks 修改的 search） > 原始请求 URL 的 search（在 hooks 前） > `baseConfigs.query` > `baseURL` 的 search
  - Headers: `ctx.headers`（已被 hooks 修改） > `request options.headers` > `baseConfigs.headers`

额外规则（与单测一致）：

- 若某键在 hooks 中被设置为 `undefined`，同名键将不会再被"请求 URL 层"覆盖，最终会保留更低层（通常是 base 层）的值。
- 若某键被设置为 `null`，则无论下层是否存在都会从最终结果中删除。

示例：

```text
base: keep=baseKeep
request URL: keep=reqKeep
hook: ctx.query.keep = undefined
=> 结果 keep=baseKeep （request URL 被忽略，保留 base）

base: rm=baseRemove
hook: ctx.query.rm = null
=> 结果 rm 被移除
```

## 钩子

你可以在钩子回调中修改上下文，然后将其作为全新的上下文 ™ 返回。

返回 `false` 立即中止请求。

```ts
export type FexiosHook<C = unknown> = (
  context: C
) => AwaitAble<C | void | false>
export interface FexiosContext<T = any> extends FexiosRequestOptions {
  url: string // 可能在 beforeInit 后发生变化
  rawRequest?: Request // 在 beforeRequest 中提供
  rawResponse?: Response // 在 afterRequest 中提供
  response?: IFexiosResponse // 在 afterRequest 中提供
  data?: T // 在 afterRequest 中提供
}
```

<details>

<summary>钩子示例</summary>

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

所有上下文按原样传递。你可以在此处进行自定义转换。

### beforeRequest

预转换已完成。

### afterBodyTransformed

- `ctx.body`: `{string|URLSearchParams|FormData|Blob}` 现在可用。

JSON 主体已转换为 JSON 字符串。`Content-Type` 头已设置为主体的类型。

### beforeActualFetch

- `ctx.rawRequest`: `{Request}` 现在可用。

Request 实例已生成。

此时，你不能再修改 `ctx.url`、`ctx.query`、`ctx.headers` 或 `ctx.body`（等）。除非你传递一个全新的 `Request` 来替换 `ctx.rawRequest`。

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

```ts
import type { FexiosPlugin } from 'fexios'

const authPlugin: FexiosPlugin = (app) => {
  app.on('beforeRequest', (ctx) => {
    ctx.headers = { ...ctx.headers, Authorization: 'Bearer token' }
    return ctx
  })
  return app // 你可以返回 app，或者省略返回值
}

const fx = new Fexios().plugin(authPlugin)
```

---

## 许可证

> MIT License
>
> Copyright (c) 2023 机智的小鱼君 (A.K.A. Dragon-Fish)

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fdragon-fish%2Ffexios?ref=badge_large)

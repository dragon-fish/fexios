# WebSocket Plugin

This plugin adds `fx.ws(...)` to connect a **WebSocket**.

## Import

```ts
import { Fexios } from 'fexios'
import { pluginWebSocket } from 'fexios/plugins'
```

## Usage

```ts
const fx = new Fexios({ baseURL: 'https://example.com' }).plugin(
  pluginWebSocket
)

const ws = await fx.ws('/ws', {
  query: { token: 'xxx' },
  timeout: 10_000,
})

ws.addEventListener('message', (event) => {
  console.log('message:', event.data)
})
```

## API

### `fx.ws(url, options?)`

- **Returns**: `Promise<WebSocket>` (resolves after the socket is opened)
- **options.protocols**: WebSocket sub-protocols passed to `new WebSocket(url, protocols)`
- **options.query**: query params to merge into the URL
- **options.timeout**: connect timeout in ms (default: `fx.baseConfigs.timeout ?? 60000`)

## URL normalization

- If `url` is `http(s)://...`, it is converted to `ws(s)://...`
- If `url` is a relative path, it is resolved against `fx.baseConfigs.baseURL` (and converted to ws/wss)

## Lifecycle events

The plugin emits the following Fexios lifecycle events:

- `websocket:beforeConnect` — allow you to modify `{ url, protocols, timeout }` before connecting
- `websocket:open`
- `websocket:message`
- `websocket:error`
- `websocket:close`

## Runtime notes (Node.js)

In Node.js, `WebSocket` may not be available globally. You can provide a polyfill (example using `ws`):

```ts
import WebSocket from 'ws'
;(globalThis as any).WebSocket = WebSocket as any
```

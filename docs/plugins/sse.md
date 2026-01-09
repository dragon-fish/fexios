# SSE (EventSource) Plugin

This plugin adds `fx.sse(...)` to create an **SSE (Server-Sent Events)** connection using `EventSource`.

## Import

```ts
import { Fexios } from 'fexios'
import { pluginSSE } from 'fexios/plugins'
```

## Usage

```ts
const fx = new Fexios({ baseURL: 'https://example.com' }).plugin(pluginSSE)

const es = await fx.sse('/events', {
  query: { room: 'lobby' },
  timeout: 30_000,
})

es.addEventListener('message', (event) => {
  console.log('message:', event.data)
})
```

## API

### `fx.sse(url, options?)`

- **Returns**: `Promise<EventSource>` (resolves after the connection is opened)
- **options.query**: query params to merge into the URL
- **options.timeout**: connect timeout in ms (default: `fx.baseConfigs.timeout ?? 60000`)

## Lifecycle events

The plugin emits the following Fexios lifecycle events:

- `sse:beforeConnect` — allow you to modify `{ url, timeout }` before connecting
- `sse:open`
- `sse:message`
- `sse:error`

## Runtime notes (Node.js)

In Node.js, `EventSource` is not always available globally. You can provide a polyfill:

```ts
import EventSource from 'eventsource'
;(globalThis as any).EventSource = EventSource
```

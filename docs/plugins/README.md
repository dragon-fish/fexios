# Plugins

This directory contains documentation for **official Fexios plugins**.

## Import path

All official plugins are exported from:

```ts
import { pluginXXX } from 'fexios/plugins'
//       ↑↑↑↑↑↑↑↑↑ Replace with the real plugin you want to use
```

## Official plugins

- **Cookie Jar**: [`docs/plugins/cookie-jar.md`](cookie-jar.md)
- **Post Form**: [`docs/plugins/post-form.md`](post-form.md)
- **SSE (EventSource)**: [`docs/plugins/sse.md`](sse.md)
- **WebSocket**: [`docs/plugins/websocket.md`](websocket.md)

## Creating a plugin (tutorial)

Fexios plugins are **objects** with a required `name` and `install(fx)` function.

### 1) Minimal plugin template

```ts
import { Fexios, type FexiosPlugin } from 'fexios'

export const authPlugin: FexiosPlugin = {
  name: 'auth-plugin',
  install(fx) {
    fx.on('beforeRequest', (ctx) => {
      ctx.request.headers = {
        ...(ctx.request.headers as any),
        Authorization: 'Bearer token',
      }
      return ctx
    })
  },
}

const fx = new Fexios()
await fx.plugin(authPlugin)
```

### 2) Uninstalling a plugin

If your plugin defines `uninstall(fx)`, Fexios will call it when you uninstall:

```ts
export const demoPlugin: FexiosPlugin = {
  name: 'demo-plugin',
  install() {
    // setup...
  },
  uninstall() {
    // cleanup...
  },
}

const fx = new Fexios()
await fx.plugin(demoPlugin)

// uninstall by name or by reference
fx.uninstall('demo-plugin')
// fx.uninstall(demoPlugin)
```

### 3) Adding instance methods (TypeScript module augmentation)

Plugins can attach new methods/fields onto the `Fexios` instance. To make it type-safe,
add module augmentation in your plugin module:

```ts
import type { FexiosPlugin } from 'fexios'

declare module 'fexios' {
  interface Fexios {
    hello: (name: string) => string
  }
}

export const helloPlugin: FexiosPlugin = {
  name: 'hello-plugin',
  install(fx) {
    fx.hello = (name) => `Hello, ${name}`
  },
  uninstall(fx) {
    fx.hello = undefined as any
  },
}
```

### 4) Hooks & lifecycle events

Inside `install(fx)`, you can use:

- `fx.on('<lifecycleEvent>', handler)` to intercept request/response lifecycle.
- `fx.interceptors.request.use(...)` / `fx.interceptors.response.use(...)` as axios-like sugar.

Official plugins (SSE/WebSocket) also emit custom lifecycle events such as
`sse:beforeConnect` / `websocket:beforeConnect`.

## Runtime notes (browser vs Node.js)

- In browsers, `EventSource` and `WebSocket` are usually available globally.
- In Node.js, you may need to provide polyfills (set them on `globalThis`) before using `pluginSSE` / `pluginWebSocket`.

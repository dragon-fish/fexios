# Changelog

## 6.0.0

### Breaking Changes

- **WebSocket (WS) and Server-Sent Events (SSE) moved out of core**

  - Core no longer supports WS/SSE detection/handling.
  - The following legacy behaviors are removed and will now throw a dedicated error:
    - `responseType: 'ws'` or `responseType: 'stream'`
    - Request URLs starting with `ws://` or `wss://`
    - Responses with `upgrade: websocket` or `content-type: text/event-stream`
  - When triggered, core throws `FexiosError` with `code: 'FEATURE_MOVED_TO_PLUGIN'` and a message guiding users to install plugins.

- **`responseType` no longer includes WS/SSE values**
  - `FexiosConfigs['responseType']` now only supports:
    - `'json' | 'text' | 'form' | 'blob' | 'arrayBuffer'`

- **`fx.plugin(plugin)` return value changed**
  - Previously, you may have relied on `fx.plugin(plugin)` returning a `Fexios` instance for chaining.
  - Now, `await fx.plugin(plugin)` returns an **uninstall helper function** (to remove the plugin), not a `Fexios` instance.
  - Migration:
    - Use `await fx.plugin(plugin)` as a standalone call (no chaining).
    - Or keep a reference:
      - `const uninstall = await fx.plugin(plugin)`

### Migration

- **Use plugins instead of core WS/SSE**

  - Install plugins from `fexios/plugins`:
    - `pluginWebSocket` for WebSocket
    - `pluginSSE` for Server-Sent Events
  - New APIs:
    - `fx.ws(url, options?) -> Promise<WebSocket>`
    - `fx.sse(url, options?) -> Promise<EventSource>`

- **New hook namespaces for real-time features**
  - WebSocket hooks:
    - `websocket:beforeConnect`, `websocket:open`, `websocket:message`, `websocket:error`, `websocket:close`
  - SSE hooks:
    - `sse:beforeConnect`, `sse:open`, `sse:message`, `sse:error`, `sse:close`

### Added

- **Plugin lifecycle support**
  - `FexiosPlugin` now supports optional `uninstall(fx)` for cleanup.
  - `fx.plugin(plugin)` now returns an uninstall function (see breaking change above).
  - `fx.uninstall(pluginOrName)` is available to remove a plugin at runtime.

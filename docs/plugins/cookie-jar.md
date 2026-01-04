# Cookie Jar Plugin

The Cookie Jar plugin adds **automatic cookie persistence** for Fexios requests:

- It appends a `Cookie` header for outgoing requests (based on request URL).
- It parses `Set-Cookie` from responses and stores cookies in-memory.
- It exposes an instance at `fx.cookieJar` for manual access.

## Import

```ts
import { Fexios } from 'fexios'
import { pluginCookieJar } from 'fexios/plugins'
```

## Usage

```ts
const fx = new Fexios({ baseURL: 'https://example.com' }).plugin(
  pluginCookieJar
)

// The plugin exposes the jar:
fx.cookieJar?.setCookie({
  name: 'foo',
  value: 'bar',
  domain: 'example.com',
  path: '/',
})

// Requests will automatically include matching cookies
await fx.get('/profile')
```

## API

The plugin exposes a `CookieJar` instance at `fx.cookieJar`.

Common methods:

- `cookieJar.setCookie(cookie, domain?, path?)`
- `cookieJar.getCookie(name, domain?, path?)`
- `cookieJar.getCookies(domain?, path?)`
- `cookieJar.getCookieHeader(domain?, path?)`
- `cookieJar.clear()`
- `cookieJar.cleanExpiredCookies()`

## Notes

- **In-memory only**: cookies are stored in memory; persistence is up to your app.
- **Multiple Set-Cookie headers**:
  - If the runtime supports `headers.getSetCookie()` (e.g. undici), the plugin will read all values.
  - Otherwise it falls back to `headers.get('set-cookie')`, which may not preserve multiple cookies in some environments.

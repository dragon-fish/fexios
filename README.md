# Fexios

Fetch based HTTP client with similar API to axios for browser and Node.js

- [x] Native fetch API
  - Supports the Promise API
- [x] Hookable (intercept request and response)
- [x] Extendable
- [x] Automatic transform request and response data
- [x] Automatic transforms for JSON data

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
fexios.get('https://zh.moegirl.org.cn')

// With options
const fexios = createFexios(/* options */)
const fexios = new Fexios(/* options */)
const fexios = Fexios.create(/* options */)
```

**In browser**

- JS Module

```ts
import('https://unpkg.com/fexios?module').then(({ createFexios }) => {
  const fexios = createFexios(/* options */)
})
```

- Traditional CDN

```html
<script src=""></script>

<script>
  // Using directly
  fexios.get('https://zh.moegirl.org.cn')

  // With options
  const { createFexios } = Fexios
  const fexios = createFexios(/* options */)
</script>
```

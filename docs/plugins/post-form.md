## Post Form plugin

Adds a convenient `fx.postForm(url, form, options?)` method.

### Install

```ts
import { Fexios } from 'fexios'
import { pluginPostForm } from 'fexios/plugins'

const fx = new Fexios()
fx.plugin(pluginPostForm)
```

### Usage

#### 1) FormData

```ts
const form = new FormData()
form.set('name', 'alice')
form.set('age', '18')

const res = await fx.postForm('/submit', form)
console.log(res.data)
```

#### 2) HTMLFormElement (browser only)

```ts
const el = document.querySelector('form#signup')!
const res = await fx.postForm('/submit', el)
console.log(res.data)
```

#### 3) Plain object

```ts
const res = await fx.postForm('/submit', {
  name: 'alice',
  avatar: new Blob(['...'], { type: 'text/plain' }),
})
```

### Notes

- **Do not manually set `Content-Type`** for FormData. Fexios will keep it unset so the runtime can attach the correct multipart boundary.


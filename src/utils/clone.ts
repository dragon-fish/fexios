export function clone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    try {
      return globalThis.structuredClone(value)
    } catch {}
  }
  return _structuredClone(value, new WeakMap())
}

function _structuredClone<T>(value: T, seen: WeakMap<object, any>): T {
  if (typeof value !== 'object' || value === null) return value

  // Self-reference check
  const cached = seen.get(value as unknown as object)
  if (cached) return cached

  // Date
  if (value instanceof Date) return new Date(value.getTime()) as any

  // RegExp
  if (value instanceof RegExp)
    return new RegExp(value.source, value.flags) as any

  // URL / URLSearchParams
  if (value instanceof URL) return new URL(value.toString()) as any
  if (value instanceof URLSearchParams)
    return new URLSearchParams(value.toString()) as any

  // ArrayBuffer / DataView / TypedArray
  if (value instanceof ArrayBuffer) return value.slice(0) as any
  if (ArrayBuffer.isView(value)) {
    if (value instanceof DataView) {
      return new DataView(
        value.buffer.slice(0),
        value.byteOffset,
        value.byteLength
      ) as any
    }
    // TypedArray：用同构造函数 + buffer 拷贝
    const ta = value as unknown as {
      constructor: any
      buffer: ArrayBuffer
      byteOffset: number
      length: number
    }
    const Ctor = ta.constructor
    return new Ctor(ta.buffer.slice(0), ta.byteOffset, ta.length) as any
  }

  // Map
  if (value instanceof Map) {
    const out = new Map()
    seen.set(value as any, out)
    value.forEach((v, k) => {
      out.set(_structuredClone(k, seen), _structuredClone(v, seen))
    })
    return out as any
  }

  // Set
  if (value instanceof Set) {
    const out = new Set()
    seen.set(value as any, out)
    value.forEach((v) => out.add(_structuredClone(v, seen)))
    return out as any
  }

  // Array
  if (Array.isArray(value)) {
    const arr = new Array((value as unknown as Array<unknown>).length)
    seen.set(value as any, arr)
    for (let i = 0; i < arr.length; i++) {
      arr[i] = _structuredClone((value as any)[i], seen)
    }
    return arr as any
  }

  // Object
  const proto = Object.getPrototypeOf(value)
  const out = Object.create(proto)
  seen.set(value as any, out)

  const descriptors = Object.getOwnPropertyDescriptors(value as object)
  for (const key of Reflect.ownKeys(descriptors)) {
    const d = (descriptors as any)[key]
    if ('value' in d) {
      d.value = _structuredClone(d.value, seen)
    }
    Object.defineProperty(out, key, d)
  }

  return out as T
}

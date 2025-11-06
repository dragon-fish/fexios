import { isPlainObject } from '@/utils/isPlainObject.js'

/**
 * Static utility class for building and merging HTTP Headers
 *
 * Notes:
 * - Conversions are not guaranteed to be reversible.
 * - Header names are treated case-insensitively by the `Headers` interface.
 * - Only one-level object is considered when building from a record.
 */
export namespace FexiosHeaderBuilder {
  /**
   * Build a Headers object from a plain record, a Map/ReadonlyMap, or an existing Headers.
   *
   * Rules:
   * - Only top-level keys are considered.
   * - Array values: append each element.
   * - Non-primitive values: use `toString()` even if it becomes "[object Object]".
   * - `undefined`/`null` values are ignored.
   *
   * @example
   * ```ts
   * makeHeaders({ 'x-foo': 'a', 'x-bar': ['b','c'], obj: { k: 1 } })
   * // => Headers with: x-foo: "a"; x-bar: "b" (append) "c"; obj: "[object Object]"
   * ```
   */
  export const makeHeaders = (
    input?:
      | Record<string, unknown>
      | Headers
      | Map<string, unknown>
      | ReadonlyMap<string, unknown>
  ): Headers => {
    if (!input) return new Headers()
    if (input instanceof Headers) return new Headers(input)

    const h = new Headers()

    if (input instanceof Map) {
      for (const [k, v] of input.entries()) {
        if (v == null) continue
        if (Array.isArray(v)) {
          for (const item of v) {
            if (item == null) continue
            h.append(k, String(item))
          }
        } else {
          h.append(k, String(v))
        }
      }
      return h
    }

    if (isPlainObject(input)) {
      for (const [k, v] of Object.entries(input)) {
        if (v == null) continue
        if (Array.isArray(v)) {
          for (const item of v) {
            if (item == null) continue
            h.append(k, String(item))
          }
        } else {
          h.append(k, String(v))
        }
      }
      return h
    }

    throw new TypeError(
      'only plain object, Map/ReadonlyMap, or Headers is supported'
    )
  }

  /**
   * Convert Headers into a plain record of string arrays.
   *
   * Notes:
   * - Returns `Record<string, string[]>` (values are arrays).
   * - Multiple underlying header values may already be combined by the platform;
   *   we do not attempt to split on commas.
   *
   * @example
   * ```ts
   * toHeaderRecord(new Headers({ 'x-foo': 'a' }))
   * // => { 'x-foo': ['a'] }
   * ```
   */
  export const toHeaderRecord = (
    input: Headers | Map<string, unknown> | ReadonlyMap<string, unknown>
  ): Record<string, string[]> => {
    // Headers → values are what the runtime provides (often joined)
    if (input instanceof Headers) {
      const out: Record<string, string[]> = {}
      input.forEach((value, key) => {
        out[key] = out[key] ? [...out[key], value] : [value]
      })
      return out
    }

    // Map / ReadonlyMap
    if (input instanceof Map) {
      const output: Record<string, string[]> = {}
      for (const [key, raw] of input.entries()) {
        if (raw == null) continue
        if (Array.isArray(raw)) {
          const arr = raw.filter((v) => v != null).map((v) => String(v))
          if (arr.length) output[key] = (output[key] ?? []).concat(arr)
        } else {
          const v = String(raw)
          output[key] = output[key] ? [...output[key], v] : [v]
        }
      }
      return output
    }

    // 其余类型统一在这里报错（集中化异常）
    throw new TypeError(
      `unsupported type transformation, got: ${Object.prototype.toString.call(
        input
      )}`
    )
  }

  /**
   * Merge multiple header representations into a new Headers.
   *
   * Semantics:
   * - `undefined` => no change for that key.
   * - `null`      => remove the key.
   * - Array value => remove the key first, then append each element.
   * - Other value => set/overwrite the key (single value).
   *
   * Sources can be `Headers`, plain objects, or Map/ReadonlyMap; processing order is left-to-right.
   * The returned `Headers` is a fresh instance; the original is not mutated.
   *
   * @example
   * ```ts
   * // Starting from existing headers
   * const base = new Headers({ 'x-a': '1', 'x-b': '2' })
   *
   * // Object patch: overwrite x-b, append two values for x-c
   * const merged = mergeHeaders(base, { 'x-b': '3', 'x-c': ['v1','v2'] })
   *
   * // Deletion via null
   * const merged2 = mergeHeaders(merged, { 'x-a': null })
   * ```
   */
  export const mergeHeaders = (
    ...incomes: Array<
      | Record<string, unknown>
      | Headers
      | Map<string, unknown>
      | ReadonlyMap<string, unknown>
      | null
      | undefined
    >
  ): Headers => {
    const output = new Headers()

    const mergeOneFromObject = (patch: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue
        if (v === null) {
          output.delete(k)
          continue
        }
        if (Array.isArray(v)) {
          output.delete(k)
          for (const item of v) {
            if (item == null) continue
            output.append(k, String(item))
          }
        } else {
          output.set(k, String(v))
        }
      }
    }

    for (const input of incomes) {
      if (input == null) continue

      if (input instanceof Headers) {
        input.forEach((value, key) => {
          output.set(key, value)
        })
        continue
      }

      if (isPlainObject(input)) {
        mergeOneFromObject(input as unknown as Record<string, unknown>)
        continue
      }

      const rec = toHeaderRecord(input as any)
      for (const [key, arr] of Object.entries(rec)) {
        output.delete(key)
        for (const v of arr) output.append(key, v)
      }
    }

    return output
  }
}

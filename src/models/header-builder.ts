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
   * Build a Headers object from a plain record or an existing Headers.
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
    init?: Record<string, unknown> | Headers
  ): Headers => {
    if (!init) return new Headers()
    if (init instanceof Headers) return new Headers(init)

    if (typeof init !== 'object' || init.constructor !== Object) {
      throw new TypeError('only plain object or Headers is supported')
    }

    const h = new Headers()
    for (const [k, v] of Object.entries(init)) {
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
    headers: Headers
  ): Record<string, string[]> => {
    const out: Record<string, string[]> = {}
    headers.forEach((value, key) => {
      // We keep whatever the runtime provides as a single element array.
      out[key] = out[key] ? [...out[key], value] : [value]
    })
    return out
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
   * Sources can be `Headers` or plain objects; processing order is left-to-right.
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
    original: Record<string, unknown> | Headers,
    ...incomes: Array<Record<string, unknown> | Headers | null | undefined>
  ): Headers => {
    // Start from a normalized copy to avoid mutating the original.
    const result =
      original instanceof Headers
        ? new Headers(original)
        : makeHeaders(original)

    const applyObject = (patch: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue
        if (v === null) {
          result.delete(k)
          continue
        }
        if (Array.isArray(v)) {
          result.delete(k) // ensure clean slate before append
          for (const item of v) {
            if (item == null) continue
            result.append(k, String(item))
          }
        } else {
          result.set(k, String(v))
        }
      }
    }

    for (const income of incomes) {
      if (income == null) continue
      if (income instanceof Headers) {
        // Treat incoming Headers as concrete values to set (not append).
        income.forEach((value, key) => {
          result.set(key, value)
        })
      } else {
        if (typeof income !== 'object' || income.constructor !== Object) {
          throw new TypeError('only plain object or Headers is supported')
        }
        applyObject(income)
      }
    }

    return result
  }
}

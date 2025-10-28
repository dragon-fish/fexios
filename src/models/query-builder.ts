/**
 * Static utility class for building URL search parameters
 *
 * @example
 * { foo: 'bar', baz: ['qux', 'quux'] } // ?foo=bar&baz=qux&baz=quux
 * @example
 * { 'foo[]': 'bar', 'baz[]': ['qux', 'quux'] } // ?foo[]=bar&baz[]=qux&baz[]=quux
 */
export namespace FexiosQueryBuilder {
  /**
   * Transform a plain object into a URL search params string.
   *
   * @example
   * ```
   * makeSearchParams({ str: '123' }) // str=123
   * makeSearchParams({ num: 123 }) // num=123
   * makeSearchParams({ bool: true }) // bool=true
   * makeSearchParams({ arr: [1, 2, 3] }) // arr=1&arr=2&arr=3
   * makeSearchParams({ plainObj: { a: 1, b: 2 } }) // plainObj[a]=1&plainObj[b]=2
   * makeSearchParams({ deepObj: { a: { b: { c: 3 } } } }) // deepObj[a][b][c]=3
   * makeSearchParams({ obj: <object> }) // obj=<object>.toString() (if object is not a primitive type)
   * makeSearchParams({ empty: '' }) // empty=
   * makeSearchParams({ null: null, undefined: undefined }) // (ignored)
   * ```
   */
  export const makeSearchParams = (
    params?: Record<string, any> | URLSearchParams
  ): URLSearchParams => {
    if (!params) {
      return new URLSearchParams()
    }
    if (params instanceof URLSearchParams) {
      return params
    }
    if (typeof params !== 'object' || params?.constructor !== Object) {
      throw new TypeError('only plain object is supported')
    }

    const sp = new URLSearchParams()

    const appendValue = (k: string, v: unknown) => {
      if (v === void 0 || v === null) return
      sp.append(k, v as any as string)
    }

    const setValue = (k: string, v: unknown) => {
      if (v === void 0 || v === null) return
      sp.set(k, v as any as string)
    }

    const handleNested = (prefix: string, val: any) => {
      if (val === void 0 || val === null) return

      // Arrays: append multiple entries with the same key
      if (Array.isArray(val)) {
        for (const item of val) appendValue(prefix, item?.toString())
        return
      }

      // Plain objects: walk entries and build bracketed keys
      if (typeof val === 'object' && val.constructor === Object) {
        for (const [k, v] of Object.entries(val)) {
          if (v === void 0 || v === null) continue

          const isBracketArrayKey = k.endsWith('[]')
          const cleanKey = isBracketArrayKey ? k.slice(0, -2) : k
          const nextPrefix = `${prefix}[${cleanKey}]`

          if (isBracketArrayKey) {
            // e.g. obj: { 'tags[]': ['a','b'] } => obj[tags][]=a&obj[tags][]=b
            const arrayKey = `${nextPrefix}[]`
            if (Array.isArray(v)) {
              for (const item of v) appendValue(arrayKey, item?.toString())
            } else if (
              typeof v === 'object' &&
              v !== null &&
              v.constructor === Object
            ) {
              // Rare case: nested object under [] – flatten recursively but keep [] at the end
              // This will produce keys like obj[tags][][sub]=x
              handleNested(`${nextPrefix}[]`, v)
            } else {
              appendValue(arrayKey, (v as any)?.toString())
            }
          } else {
            if (Array.isArray(v)) {
              // e.g. obj: { arr: [1,2] } => obj[arr]=1&obj[arr]=2
              for (const item of v) appendValue(nextPrefix, item?.toString())
            } else if (
              typeof v === 'object' &&
              v !== null &&
              v.constructor === Object
            ) {
              // deeper nesting
              handleNested(nextPrefix, v)
            } else {
              setValue(nextPrefix, (v as any)?.toString())
            }
          }
        }
        return
      }

      // Primitives and other objects (e.g., Date)
      setValue(prefix, val?.toString())
    }

    for (const [key, value] of Object.entries(params)) {
      handleNested(key, value)
    }

    return sp
  }

  /**
   * Build query string from a record object with proper array handling
   * @param query - The query object containing key-value pairs
   * @returns URL-encoded query string
   */
  export const makeQueryString = (query: Record<string, any>): string => {
    return makeSearchParams(query).toString()
  }

  /**
   * Create a URL object with the given parameters.
   *
   * @example
   * ```
   * makeURL('https://example.com?existing=1', { foo: 'bar' }, 'baz') // https://example.com?existing=1&foo=bar#baz
   */
  export const makeURL = (
    url: string | URL,
    params?: Record<string, any>,
    hash?: string
  ): URL => {
    const u =
      typeof url === 'string'
        ? new URL(url, window?.location?.origin)
        : new URL(url)

    const existingParams = new URLSearchParams(u.search)
    const newParams = makeSearchParams(params)
    for (const [key, value] of newParams.entries()) {
      existingParams.set(key, value)
    }

    u.search = existingParams.toString()
    u.hash = hash || ''
    return u
  }

  /**
   * Convert URLSearchParams back to a plain object
   *
   * @note numbers/booleans or special objects (e.g. Date) are not restored, all values are strings
   *
   * @example
   * ```
   * // Basic key-value pairs
   * toQueryRecord(new URLSearchParams('foo=bar&baz=qux&number=123&bool=true'))
   * // -> { foo: 'bar', baz: 'qux', number: '123', bool: 'true' }
   *
   * // Repeated keys are converted to arrays
   * toQueryRecord(new URLSearchParams('foo=bar&foo=baz&single=value'))
   * // -> { foo: ['bar', 'baz'], single: 'value' }
   *
   * // Nested objects are reconstructed
   * toQueryRecord(new URLSearchParams('obj[foo]=bar&obj[baz]=qux&deep[dark][fantasy]=yes'))
   * // -> { obj: { foo: 'bar', baz: 'qux' }, deep: { dark: { fantasy: 'yes' } } }
   *
   * // Key with [] suffix always treated as array
   * toQueryRecord(new URLSearchParams('arr[]=only-one-value'))
   * // -> { 'arr[]': ['only-one-value'] }
   * ```
   */
  export const toQueryRecord = <T = any>(searchParams: URLSearchParams): T => {
    const out: any = {}

    const parseKey = (key: string): { path: string[]; forceArray: boolean } => {
      if (!key.includes('[')) {
        // plain key, keep as-is
        return { path: [key], forceArray: false }
      }

      const base = key.slice(0, key.indexOf('['))
      const parts: string[] = [base]
      const re = /\[([^\]]*)\]/g

      let m: RegExpExecArray | null
      let forceArray = false
      let lastWasEmpty = false

      while ((m = re.exec(key))) {
        if (m[1] === '') {
          // empty [] indicates array semantics
          forceArray = true
          lastWasEmpty = true
        } else {
          parts.push(m[1])
          lastWasEmpty = false
        }
      }

      // If the key ends with [], keep the [] suffix on the final named segment
      if (forceArray && lastWasEmpty) {
        parts[parts.length - 1] = parts[parts.length - 1] + '[]'
      }

      return { path: parts, forceArray }
    }

    const setDeep = (
      obj: any,
      path: string[],
      value: string,
      forceArray: boolean
    ) => {
      let cur = obj

      for (let i = 0; i < path.length; i++) {
        const k = path[i]
        const last = i === path.length - 1

        if (last) {
          if (forceArray) {
            if (cur[k] === undefined) cur[k] = [value]
            else if (Array.isArray(cur[k])) cur[k].push(value)
            else cur[k] = [cur[k], value]
          } else {
            if (cur[k] === undefined) cur[k] = value
            else if (Array.isArray(cur[k])) cur[k].push(value)
            else cur[k] = [cur[k], value]
          }
        } else {
          if (
            cur[k] === undefined ||
            typeof cur[k] !== 'object' ||
            Array.isArray(cur[k])
          ) {
            cur[k] = {}
          }
          cur = cur[k]
        }
      }
    }

    for (const [rawKey, val] of searchParams) {
      const { path, forceArray } = parseKey(rawKey)
      setDeep(out, path, val, forceArray)
    }

    return out as T
  }

  /**
   * Merge multiple query representations into a single plain object.
   *
   * @note income `undefined` meaning no change, `null` meaning remove the key.
   *
   * @example
   * ```
   * mergeQueries({ a: '1' }, { b: '2' }, { c: '3' }) // { a: '1', b: '2', c: '3' }
   * mergeQueries({ a: '1', b: '2' }, { b: '3', c: '4' }) // { a: '1', b: '3', c: '4' }
   * mergeQueries({ a: '1', b: '2' }, null, { c: '3' }) // { a: '1', b: '2', c: '3' }
   * mergeQueries({ a: '1', b: '2' }, { b: null }, { c: '3' }) // { a: '1', c: '3' }
   * mergeQueries(new URLSearchParams('a=1&b=2'), { b: '3', c: '4' }) // { a: '1', b: '3', c: '4' }
   * mergeQueries({ a: '1' }, new URLSearchParams('b=2&c=3')) // { a: '1', b: '2', c: '3' }
   */
  export const mergeQueries = <T = any>(
    original: Record<string, any> | URLSearchParams | string,
    ...incomes: Array<
      Record<string, any> | URLSearchParams | string | null | undefined
    >
  ): T => {
    const isPlainObject = (v: any): v is Record<string, any> =>
      v !== null && typeof v === 'object' && v.constructor === Object

    const clone = (v: any): any => {
      if (Array.isArray(v)) return v.map(clone)
      if (isPlainObject(v)) {
        const o: any = {}
        for (const [k, val] of Object.entries(v)) o[k] = clone(val)
        return o
      }
      return v
    }

    // Accepts:
    // - '?a=1&b=2'
    // - 'a=1&b=2'
    // - 'https://x.com/path?a=1#hash'
    const spFromString = (s: string): URLSearchParams => {
      const t = s.trim()
      if (!t) return new URLSearchParams()
      if (t.startsWith('?')) return new URLSearchParams(t.slice(1))
      if (t.includes('?'))
        return new URLSearchParams(t.slice(t.indexOf('?') + 1))
      return new URLSearchParams(t)
    }

    const toPlain = (src: any): Record<string, any> => {
      if (!src) return {}
      if (src instanceof URLSearchParams) return toQueryRecord(src)
      if (typeof src === 'string') return toQueryRecord(spFromString(src))
      if (isPlainObject(src)) return src
      throw new TypeError(
        'only plain object, URLSearchParams, or query string is supported'
      )
    }

    const result: Record<string, any> = clone(toPlain(original))

    const apply = (target: Record<string, any>, patch: Record<string, any>) => {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue
        if (v === null) {
          delete target[k]
          continue
        }
        const cur = target[k]
        if (isPlainObject(cur) && isPlainObject(v)) {
          apply(cur, v)
        } else {
          target[k] = clone(v)
        }
      }
    }

    for (const income of incomes) {
      if (income == null) continue
      if (income instanceof URLSearchParams) {
        apply(result, toQueryRecord(income))
      } else if (typeof income === 'string') {
        apply(result, toPlain(income))
      } else {
        if (typeof income !== 'object' || income.constructor !== Object) {
          throw new TypeError(
            'only plain object, URLSearchParams, or query string is supported'
          )
        }
        apply(result, income)
      }
    }

    return result as T
  }
}

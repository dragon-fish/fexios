import { clone } from './clone'
import { isPlainObject } from './isPlainObject'

export function deepMerge<T = any>(
  obj: Partial<T>,
  ...incomes: (Partial<T> | null | undefined)[]
): T {
  const result: Record<PropertyKey, any> = clone(obj || ({} as T))

  for (const inc of incomes) {
    // skip if income is null/undefined
    if (inc == null) continue

    for (const key of Reflect.ownKeys(inc)) {
      const nextVal = (inc as any)[key]

      // undefined = as is
      if (typeof nextVal === 'undefined') continue

      // null = delete property
      if (nextVal === null) {
        delete result[key]
        continue
      }

      const prevVal = result[key]
      if (isPlainObject(prevVal) && isPlainObject(nextVal)) {
        // deep merge plain object
        result[key] = deepMerge(prevVal, nextVal)
      } else {
        // overwrite other types (including arrays, Map/Set/Date, etc.: replaced with incoming value)
        result[key] = clone(nextVal)
      }
    }
  }

  return result as unknown as T
}

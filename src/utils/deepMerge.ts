import { clone } from './clone'
import { isPlainObject } from './isPlainObject'

export function deepMerge<T = any>(
  obj: Partial<T>,
  ...incomes: (Partial<T> | null | undefined)[]
): T {
  const result: Record<PropertyKey, any> = clone(obj || ({} as T))

  for (const inc of incomes) {
    // 整个 income 为 null/undefined：跳过（删除语义仅作用于“键的值为 null”的情况）
    if (inc == null) continue

    for (const key of Reflect.ownKeys(inc)) {
      const nextVal = (inc as any)[key]

      // undefined = 不改动
      if (typeof nextVal === 'undefined') continue

      // null = 删除属性
      if (nextVal === null) {
        delete result[key]
        continue
      }

      const prevVal = result[key]
      if (isPlainObject(prevVal) && isPlainObject(nextVal)) {
        // 深合并 plain object
        result[key] = deepMerge(prevVal, nextVal)
      } else {
        // 其它情况直接覆写（含数组、Map/Set/Date 等：交给你的 clone）
        result[key] = clone(nextVal)
      }
    }
  }

  return result as unknown as T
}

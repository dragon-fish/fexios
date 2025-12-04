/**
 * Check if given payload is a plain object
 * "Plain object" means it is not an instance of any class or built-in type,
 * or just like Record<string, any> in TypeScript.
 */
export function isPlainObject(payload: any): payload is Record<string, any> {
  // exclude non-object and null values
  if (typeof payload !== 'object' || payload === null) {
    return false
  }

  // exclude built-in types like Date, RegExp, etc.
  // only Object.prototype or null is acceptable as prototype
  const proto = Object.getPrototypeOf(payload)
  return proto === Object.prototype || proto === null
}

export {
  /** @deprecated use isPlainObject instead */
  isPlainObject as checkIsPlainObject,
}

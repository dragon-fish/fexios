/**
 * Utility functions for Fexios
 */

/**
 * Check if the data is likely text content
 */
export function checkIfTextData(uint8Array: Uint8Array, maxBytesToCheck = 1024): boolean {
  // 确保输入是一个 Uint8Array
  if (!(uint8Array instanceof Uint8Array)) {
    throw new TypeError('Input must be a Uint8Array')
  }

  // 截取前 maxBytesToCheck 字节进行检查
  const dataToCheck = uint8Array.slice(0, maxBytesToCheck)

  // 使用 TextDecoder 尝试解码为 UTF-8 字符串
  const decoder = new TextDecoder('utf-8', { fatal: true })
  try {
    const decodedString = decoder.decode(dataToCheck)

    // 检查解码后的字符串是否包含大量不可打印字符
    const nonPrintableRegex = /[\x00-\x08\x0E-\x1F\x7F]/g // 匹配控制字符
    const nonPrintableMatches = decodedString.match(nonPrintableRegex)

    // 如果不可打印字符占比过高，则认为是二进制数据
    const threshold = 0.1 // 允许最多 10% 的不可打印字符
    if (
      nonPrintableMatches &&
      nonPrintableMatches.length / decodedString.length > threshold
    ) {
      return false // 是二进制数据
    }

    // 否则认为是文本数据
    return true
  } catch (error) {
    // 如果解码失败（例如包含无效的 UTF-8 序列），认为是二进制数据
    return false
  }
}

/**
 * Check if given payload is a plain object
 * "plain object", means it is not an instance of any class or built-in type,
 * or just like Record<string, any> in TypeScript.
 */
export function checkIsPlainObject(payload: any): payload is Record<string, any> {
  // exclude non-object and null values
  if (typeof payload !== 'object' || payload === null) {
    return false
  }

  // exclude built-in types like Date, RegExp, etc.
  if (Object.prototype.toString.call(payload) !== '[object Object]') {
    return false
  }

  // finally check the prototype chain
  // if the prototype is Object.prototype or null, it's 99% a plain object
  // Note: why proto === null is ok? // Object.create(null)
  const proto = Object.getPrototypeOf(payload)
  return proto === Object.prototype || proto === null
}

/**
 * Remove all undefined and null properties from an object
 * Also handles empty strings based on options
 */
export function dropUndefinedAndNull<T extends Record<string, any>>(
  obj: T,
  options: { dropEmptyString?: boolean } = {}
): Partial<T> {
  const newObj: Record<string, any> = {}
  Object.entries(obj).forEach(([key, value]) => {
    // Always drop undefined and null
    if (value === undefined || value === null) {
      return
    }
    // Optionally drop empty strings
    if (options.dropEmptyString && value === '') {
      return
    }
    newObj[key] = value
  })
  return newObj as Partial<T>
}

/**
 * Utility functions for Fexios
 */

/**
 * Check if the data is likely text content
 */
export function checkIfTextData(
  uint8Array: Uint8Array,
  maxBytesToCheck = 2048
): boolean {
  if (!(uint8Array instanceof Uint8Array)) {
    throw new TypeError('Input must be a Uint8Array')
  }

  if (uint8Array.length === 0) {
    return true
  }

  // Check at least 256 bytes, up to maxBytesToCheck
  const bytesToCheck = Math.min(
    Math.max(uint8Array.length, 256),
    maxBytesToCheck
  )
  const dataToCheck = uint8Array.slice(0, bytesToCheck)

  // 1. Check for BOM and common binary file headers
  if (hasBinaryHeader(dataToCheck)) {
    return false
  }

  // 2. Analyze byte distribution characteristics
  const stats = analyzeByteDistribution(dataToCheck)

  // Too many null bytes likely indicate binary data
  if (stats.nullByteRatio > 0.05) {
    return false
  }

  // Too many high bytes might indicate binary data
  if (stats.highByteRatio > 0.95) {
    return false
  }

  // 3. Try multiple encodings for decoding
  const encodings = ['utf-8', 'utf-16le', 'utf-16be', 'iso-8859-1']
  let bestScore = -1
  let isValidText = false

  for (const encoding of encodings) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: true })
      const decodedString = decoder.decode(dataToCheck)
      const score = calculateTextScore(decodedString)

      if (score > bestScore) {
        bestScore = score
        isValidText = score > 0.7 // Text confidence threshold
      }
    } catch (error) {
      // Decoding failed, try next encoding
      continue
    }
  }

  return isValidText
}

/**
 * Check for common binary file headers
 */
function hasBinaryHeader(data: Uint8Array): boolean {
  if (data.length < 4) return false

  // Common binary file header signatures
  const binaryHeaders = [
    [0x89, 0x50, 0x4e, 0x47], // PNG
    [0xff, 0xd8, 0xff], // JPEG
    [0x47, 0x49, 0x46], // GIF
    [0x25, 0x50, 0x44, 0x46], // PDF
    [0x50, 0x4b, 0x03, 0x04], // ZIP/Office documents
    [0x50, 0x4b, 0x05, 0x06], // ZIP empty archive
    [0x50, 0x4b, 0x07, 0x08], // ZIP spanned archive
    [0x7f, 0x45, 0x4c, 0x46], // ELF executable
    [0x4d, 0x5a], // Windows executable
    [0xca, 0xfe, 0xba, 0xbe], // Java class file
    [0x00, 0x00, 0x01, 0x00], // ICO
    [0x52, 0x49, 0x46, 0x46], // RIFF (AVI, WAV, etc.)
  ]

  for (const header of binaryHeaders) {
    if (data.length >= header.length) {
      let matches = true
      for (let i = 0; i < header.length; i++) {
        if (data[i] !== header[i]) {
          matches = false
          break
        }
      }
      if (matches) return true
    }
  }

  return false
}

/**
 * Analyze byte distribution characteristics
 */
function analyzeByteDistribution(data: Uint8Array): {
  nullByteRatio: number
  highByteRatio: number
  controlCharRatio: number
} {
  let nullBytes = 0
  let highBytes = 0
  let controlChars = 0

  for (const byte of data) {
    if (byte === 0) {
      nullBytes++
    }
    if (byte > 127) {
      highBytes++
    }
    // Control characters (excluding common ones like newline, tab, etc.)
    if (
      (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) ||
      byte === 127
    ) {
      controlChars++
    }
  }

  return {
    nullByteRatio: nullBytes / data.length,
    highByteRatio: highBytes / data.length,
    controlCharRatio: controlChars / data.length,
  }
}

/**
 * Calculate text content confidence score
 */
function calculateTextScore(text: string): number {
  if (text.length === 0) return 1

  let score = 1.0
  let printableChars = 0
  let textLikeChars = 0

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const code = char.charCodeAt(0)

    // Printable ASCII characters
    if (code >= 32 && code <= 126) {
      printableChars++
      textLikeChars++
    }
    // Common whitespace characters
    else if (code === 9 || code === 10 || code === 13 || code === 32) {
      textLikeChars++
    }
    // Unicode characters (possibly text in other languages)
    else if (code > 127 && code < 0xfffe) {
      // Check if it's a valid Unicode character
      if (!isControlCharacter(code) && !isPrivateUse(code)) {
        textLikeChars++
      }
    }
    // Control characters or special characters lower the score
    else {
      score -= 0.1
    }
  }

  // Adjust score based on printable character ratio
  const textRatio = textLikeChars / text.length
  score *= textRatio

  // Boost score if common text patterns are found
  if (hasTextPatterns(text)) {
    score *= 1.1
  }

  return Math.max(0, Math.min(1, score))
}

/**
 * Check if the character code is a control character
 */
function isControlCharacter(code: number): boolean {
  return (code >= 0 && code <= 31) || (code >= 127 && code <= 159)
}

/**
 * Check if the character code is in private use area
 */
function isPrivateUse(code: number): boolean {
  return (
    (code >= 0xe000 && code <= 0xf8ff) ||
    (code >= 0xf0000 && code <= 0xffffd) ||
    (code >= 0x100000 && code <= 0x10fffd)
  )
}

/**
 * Check for common text patterns
 */
function hasTextPatterns(text: string): boolean {
  // Check for words, sentences and other text features
  const patterns = [
    /\b\w+\b/, // Words
    /[.!?]+\s/, // Sentence endings
    /\s+/, // Whitespace
    /[a-zA-Z]{3,}/, // English words
    /[\u4e00-\u9fa5]+/, // Chinese characters
    /\d+/, // Numbers
  ]

  return patterns.some((pattern) => pattern.test(text))
}

/**
 * Check if given payload is a plain object
 * "plain object", means it is not an instance of any class or built-in type,
 * or just like Record<string, any> in TypeScript.
 */
export function checkIsPlainObject(
  payload: any
): payload is Record<string, any> {
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

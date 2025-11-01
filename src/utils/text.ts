/**
 * Try to decode Uint8Array as text using multiple encodings.
 * Return undefined if it likely isn't text or all decodings look bad.
 *
 * @param encodings see https://developer.mozilla.org/zh-CN/docs/Web/API/Encoding_API/Encodings
 */
export function decodeTextSmart(
  data: Uint8Array,
  encodings: string | string[] = DEFAULT_ENCODINGS.slice(),
  sampleSize = 1024,
  threshold = 0.85
): string | undefined {
  if (!data?.length) return ''
  if (!Array.isArray(encodings) || encodings.length === 0) {
    encodings = ['utf-8']
  }
  encodings = Array.from(new Set(encodings))

  console.info('decodeTextSmart', data, encodings)

  // 1) byte-level quick filter
  if (!isProbablyTextData(data, sampleSize, threshold)) return undefined

  // 2) put BOM-detected encoding at front (if any), remove duplicates while preserving order
  const bomEnc = detectBOM(data)
  const order = dedupe([bomEnc, ...encodings].filter(Boolean) as string[])

  // 3) try decodings in order
  for (const enc of order) {
    try {
      const decoder = new TextDecoder(enc, { fatal: false }) // keep non-fatal; we score by U+FFFD
      const text = decoder.decode(data)
      if (textQualityScore(text) >= threshold) return text
    } catch {
      // ignore and try next encoding
    }
  }

  return undefined
}

/**
 * Quickly check if the given Uint8Array data is probably text data.
 * Heuristic via byte sampling.
 */
export function isProbablyTextData(
  data: Uint8Array,
  sampleSize = 1024,
  threshold = 0.85
): boolean {
  if (!data.length) return true
  return printableByteRatio(data, sampleSize) >= threshold
}

/** @deprecated Use isProbablyTextData instead */
export const checkIfTextData = isProbablyTextData

/* -------------------- internals -------------------- */

const DEFAULT_ENCODINGS = [
  'utf-8',
  'utf-16le',
  'utf-16be',
  'iso-8859-1',
] as const

function dedupe<T>(arr: T[]): T[] {
  const seen = new Set<T>()
  const out: T[] = []
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x)
      out.push(x)
    }
  }
  return out
}

function detectBOM(data: Uint8Array): string | undefined {
  if (
    data.length >= 3 &&
    data[0] === 0xef &&
    data[1] === 0xbb &&
    data[2] === 0xbf
  )
    return 'utf-8'
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe)
    return 'utf-16le'
  if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff)
    return 'utf-16be'
  return undefined
}

function sampleStep(len: number, sampleSize: number): number {
  const safeSize = Math.max(1, sampleSize | 0)
  return Math.max(1, Math.ceil(len / Math.min(len, safeSize)))
}

function isLikelyTextByte(byte: number): boolean {
  // ASCII printable
  if (byte >= 32 && byte <= 126) return true
  // \t \n \r
  if (byte === 9 || byte === 10 || byte === 13) return true
  // UTF-8 multi-byte leading bytes (0xC2–0xF4) – permissive heuristic
  if (byte >= 0xc2 && byte <= 0xf4) return true
  return false
}

function printableByteRatio(data: Uint8Array, sampleSize: number): number {
  const len = data.length
  const step = sampleStep(len, sampleSize)
  let printable = 0
  let checked = 0

  for (let i = 0; i < len; i += step) {
    checked++
    if (isLikelyTextByte(data[i]!)) printable++
  }
  return checked ? printable / checked : 1
}

function textQualityScore(text: string): number {
  // Score in [0,1], penalize replacement characters U+FFFD.
  // Empty text is considered perfect (score 1)
  const total = text.length
  if (!total) return 1
  const bad = (text.match(/\uFFFD/g) ?? []).length
  return 1 - bad / total
}

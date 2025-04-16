export interface RetryOptions {
  retries: number
  delay: number
  onError: (error: Error, attempt: number) => void
  shouldRetry: (error: Error, attempt: number) => boolean
  signal: AbortSignal
}

/**
 * Return a promise that resolves to the result of the function,
 * or throw final error if all retries fail.
 * @param fn The function to retry
 * @param options
 */
export async function retry<T>(
  fn: () => T | Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    retries = 0,
    delay = 0,
    onError = () => {},
    shouldRetry = () => true,
    signal,
  } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (signal?.aborted) {
        throw new Error('Aborted')
      }
      if (!shouldRetry(error as Error, attempt)) {
        break
      }
      onError(lastError, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

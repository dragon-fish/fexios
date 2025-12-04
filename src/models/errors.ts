import type { FexiosContext, IFexiosResponse } from '../types.js'

/**
 * Error codes for Fexios
 */
export enum FexiosErrorCodes {
  BODY_USED = 'BODY_USED',
  NO_BODY_READER = 'NO_BODY_READER',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  BODY_NOT_ALLOWED = 'BODY_NOT_ALLOWED',
  HOOK_CONTEXT_CHANGED = 'HOOK_CONTEXT_CHANGED',
  ABORTED_BY_HOOK = 'ABORTED_BY_HOOK',
  INVALID_HOOK_CALLBACK = 'INVALID_HOOK_CALLBACK',
  UNEXPECTED_HOOK_RETURN = 'UNEXPECTED_HOOK_RETURN',
  UNSUPPORTED_RESPONSE_TYPE = 'UNSUPPORTED_RESPONSE_TYPE',
  BODY_TRANSFORM_ERROR = 'BODY_TRANSFORM_ERROR',
}

/**
 * Base Fexios error class
 */
export class FexiosError extends Error {
  name = 'FexiosError'
  constructor(
    readonly code: FexiosErrorCodes | string,
    message?: string,
    readonly context?: FexiosContext,
    options?: ErrorOptions
  ) {
    super(message, options)
  }
  static is(e: any, code?: FexiosErrorCodes): e is FexiosError {
    if (!(e instanceof FexiosError) || e instanceof FexiosResponseError) {
      return false
    }
    return code ? e.code === code : true
  }
}

/**
 * Fexios response error class for HTTP errors
 */
export class FexiosResponseError<T> extends FexiosError {
  name = 'FexiosResponseError'
  constructor(
    message: string,
    readonly response: IFexiosResponse<T>,
    options?: ErrorOptions
  ) {
    super(response.statusText, message, undefined, options)
  }
  static is(e: any): e is FexiosResponseError<any> {
    return e instanceof FexiosResponseError
  }
}

/**
 * Check if the error is a FexiosError that not caused by Response error
 * @deprecated Use FexiosError.is(e) instead
 */
export const isFexiosError = (e: any): boolean => {
  return FexiosError.is(e)
}

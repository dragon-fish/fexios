import type {
  FexiosContext,
  FexiosFinalContext,
  FexiosConfigs,
  FexiosHookStore,
  FexiosLifecycleEvents,
  FexiosLifecycleEventMap,
} from '../types.js'
import {
  createFexiosResponse,
  FexiosError,
  FexiosErrorCodes,
  FexiosResponse,
} from '../models/index.js'
import { finalizeContext } from './context.js'

/**
 * Duck-type check: is this value shaped like a FexiosFinalContext?
 */
export function isFinalContextLike(v: any): v is FexiosFinalContext<any> {
  if (!v || typeof v !== 'object') return false
  const req = (v as any).request
  const res = (v as any).response
  const raw = (v as any).rawResponse
  if (!req || !res || !raw) return false
  if (typeof req.url !== 'string') return false
  return (
    raw instanceof Response ||
    res?.rawResponse instanceof Response ||
    res?.rawResponse?.constructor?.name === 'Response'
  )
}

/**
 * When a hook returns a Response or FexiosResponse (short-circuit),
 * build the final context and optionally run afterResponse hooks.
 */
export async function resolveShortCircuit(
  ctx: any,
  responseOrRaw: FexiosResponse<any> | Response,
  event: FexiosLifecycleEvents,
  emitFn: (event: FexiosLifecycleEvents, ctx: any) => Promise<any>,
  finalSymbol: symbol,
  baseConfigs: FexiosConfigs
): Promise<any> {
  const finalCtx: any = ctx
  let response: FexiosResponse<any>

  if (responseOrRaw instanceof FexiosResponse) {
    response = responseOrRaw
    finalCtx.rawResponse = response.rawResponse
  } else {
    // It is a raw Response
    finalCtx.rawResponse = responseOrRaw
    response = await createFexiosResponse(
      responseOrRaw,
      (ctx as any).request?.responseType,
      (ctx as any).request?.shouldThrow ?? baseConfigs.shouldThrow,
      (ctx as any).request?.timeout ?? baseConfigs.timeout ?? 60 * 1000
    )
  }

  finalCtx.response = response
  // Keep the same invariant: rawResponse === response.rawResponse
  finalCtx.rawResponse = response.rawResponse

  // Ensure rawRequest exists even when short-circuited before actual fetch
  if (!finalCtx.request?.rawRequest) {
    try {
      finalCtx.request.rawRequest = new Request(finalCtx.request.url, {
        method: finalCtx.request.method || 'GET',
        headers: finalCtx.request.headers as any,
        body: finalCtx.request.body as any,
      })
    } catch {
      // ignore
    }
  }

  finalizeContext(finalCtx, response.rawResponse?.url || '')

  if (event !== 'afterResponse') {
    const after = (await emitFn('afterResponse', finalCtx)) as any
    ;(after as any)[finalSymbol] = true
    return after
  } else {
    ;(finalCtx as any)[finalSymbol] = true
    return finalCtx
  }
}

/**
 * Execute all hooks for a given lifecycle event.
 */
export async function executeHooks<
  E extends FexiosLifecycleEvents,
  C = FexiosLifecycleEventMap[E]
>(
  hooks: FexiosHookStore[],
  thisArg: any,
  event: E,
  ctx: C,
  finalSymbol: symbol,
  baseConfigs: FexiosConfigs,
  emitFn: (event: FexiosLifecycleEvents, ctx: any, opts?: any) => Promise<any>,
  opts: { shouldHandleShortCircuitResponse?: boolean } = {
    shouldHandleShortCircuitResponse: true,
  }
): Promise<C> {
  const filtered = hooks.filter((h) => h.event === event)
  if (filtered.length === 0) return ctx

  for (let i = 0; i < filtered.length; i++) {
    const hook = filtered[i]
    const hookName = `${String(event)}#${
      hook.action.name || `anonymous#${i}`
    }`

    // Mark context to detect if hook returns the same object or a new one
    const marker = Symbol('FEXIOS_HOOK_CTX_MARK')
    try {
      ;(ctx as any)[marker] = marker
    } catch {}

    const result = await hook.action.call(thisArg, ctx as any)

    const isSameContext = result === ctx
    const hasMarker =
      result &&
      typeof result === 'object' &&
      (result as any)[marker] === marker

    try {
      delete (ctx as any)[marker]
    } catch {}

    if (result === false) {
      throw new FexiosError(
        FexiosErrorCodes.ABORTED_BY_HOOK,
        `Request aborted by hook "${hookName}"`,
        ctx as unknown as FexiosContext
      )
    }

    // Check for marker/same object FIRST to allow flowing through
    if (isSameContext || hasMarker) {
      // Hook returned the same context object (or compatible)
      ctx = result as C
      continue
    }

    // Allow hook to return an already-finalized context (short-circuit)
    if (isFinalContextLike(result)) {
      ;(result as any)[finalSymbol] = true
      return result as any
    }

    // Allow hook to return a parsed FexiosResponse directly
    if (result instanceof FexiosResponse) {
      return resolveShortCircuit(ctx, result, event, emitFn, finalSymbol, baseConfigs)
    }

    if (result instanceof Response) {
      if (opts.shouldHandleShortCircuitResponse !== false) {
        return resolveShortCircuit(ctx, result, event, emitFn, finalSymbol, baseConfigs)
      }
      ;(ctx as any).rawResponse = result
    } else {
      // no-op
    }
  }

  return ctx
}

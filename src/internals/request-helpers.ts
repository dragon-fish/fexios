import type { FexiosConfigs, FexiosContext } from '../types.js'
import { FexiosQueryBuilder } from '../models/query-builder.js'
import { FexiosHeaderBuilder } from '../models/header-builder.js'
import { isPlainObject } from '../utils/isPlainObject.js'

/**
 * Recursively restore null values from source into target.
 * Used to ensure null values in ctx.query can delete params later.
 */
export function restoreNulls(target: any, source: any): void {
  if (!source || typeof source !== 'object') return
  for (const [k, v] of Object.entries(source)) {
    if (v === null) {
      target[k] = null
    } else if (isPlainObject(v)) {
      if (!target[k] || typeof target[k] !== 'object') {
        target[k] = {}
      }
      restoreNulls(target[k], v)
    }
  }
}

/**
 * Apply default configs to request context: resolve URL against baseURL,
 * merge base search params, merge query params.
 */
export function applyDefaults(requestCtx: any, baseConfigs: FexiosConfigs): any {
  const c = requestCtx as any

  const fallback = globalThis.location?.href || 'http://localhost'

  // 1. Resolve Base URL
  // Priority: ctx.baseURL > defaults.baseURL > fallback
  const effectiveBase = c.baseURL || baseConfigs.baseURL || fallback

  const baseObj = new URL(effectiveBase, fallback)

  // 2. Resolve Full URL & Merge Base Search Params
  // new URL(path, base) will drop base's search params, so we need to merge them manually
  const reqURL = new URL(c.url.toString(), baseObj)

  const baseSearchParams = FexiosQueryBuilder.toQueryRecord(
    baseObj.searchParams
  )
  const reqSearchParams = FexiosQueryBuilder.toQueryRecord(
    reqURL.searchParams
  )

  // Priority: ctx.url (reqSearchParams) > base (baseSearchParams)
  const mergedSearchParams = FexiosQueryBuilder.mergeQueries(
    baseSearchParams,
    reqSearchParams
  )

  // Write back merged search params
  reqURL.search =
    FexiosQueryBuilder.makeSearchParams(mergedSearchParams).toString()

  // Update ctx.url to full URL
  // We keep ctx.baseURL for potential later usage (e.g. if hook changes url to relative)
  c.url = reqURL.toString()
  // delete c.baseURL

  // 3. Merge ctx.query
  // Priority: ctx.query > defaults.query
  // Note: ctx.query is NOT merged with ctx.url search params here
  const mergedQuery = FexiosQueryBuilder.mergeQueries(
    baseConfigs.query,
    c.query
  )

  // Restore null values from ctx.query to ensure they can delete params from URL later
  if (c.query) {
    restoreNulls(mergedQuery, c.query)
  }

  ;(c as any).query = mergedQuery

  return c
}

/**
 * Resolve the request body and determine auto Content-Type header patches.
 * Returns { body, headerAutoPatch }.
 */
export function transformBody(
  req: any,
  mergeHeadersFn: typeof FexiosHeaderBuilder.mergeHeaders
): {
  body: string | FormData | URLSearchParams | Blob | undefined
  headerAutoPatch: Record<string, unknown>
} {
  let body: string | FormData | URLSearchParams | Blob | undefined
  const headerAutoPatch: Record<string, unknown> = {}

  if (typeof req.body !== 'undefined' && req.body !== null) {
    if (
      req.body instanceof Blob ||
      req.body instanceof FormData ||
      req.body instanceof URLSearchParams
    ) {
      body = req.body
    } else if (typeof req.body === 'object' && req.body !== null) {
      body = JSON.stringify(req.body)
      req.headers = mergeHeadersFn(req.headers, {
        'Content-Type': 'application/json',
      })
    } else {
      body = req.body
    }
  }

  // if user didn't explicitly give content-type, auto patch it based on body
  const optionsHeaders = FexiosHeaderBuilder.makeHeaders(req.headers || {})
  if (!optionsHeaders.get('content-type') && body) {
    if (body instanceof FormData || body instanceof URLSearchParams) {
      // let browser set boundary automatically
      headerAutoPatch['content-type'] = null
    } else if (typeof body === 'string' && typeof req.body === 'object') {
      headerAutoPatch['content-type'] = 'application/json'
    } else if (body instanceof Blob) {
      headerAutoPatch['content-type'] =
        body.type || 'application/octet-stream'
    }
  }

  return { body, headerAutoPatch }
}

/**
 * Build the final URL string from ctx.request after all hooks have run.
 * Resolves baseURL, merges query params into URL search params.
 */
export function buildFinalURL(
  ctx: FexiosContext,
  baseConfigs: FexiosConfigs
): string {
  const fallback = globalThis.location?.href || 'http://localhost'
  // Resolve base URL to absolute
  const baseForRequest = new URL(
    (ctx.request as any).baseURL || baseConfigs.baseURL || fallback,
    fallback
  )
  const urlObjForRequest = new URL((ctx.request as any).url, baseForRequest)

  // Merge ctx.query into URL searchParams (ctx.query takes priority)
  return FexiosQueryBuilder.makeURL(
    urlObjForRequest,
    (ctx.request as any).query,
    urlObjForRequest.hash // preserve hash
  ).toString()
}

import type {
  FexiosFinalContext,
  FexiosPlugin,
  FexiosRequestOptions,
} from '@/types.js'
import { isPlainObject } from '@/utils/isPlainObject.js'

export type FexiosPostFormInput = FormData | HTMLFormElement
export type FexiosPostFormRecord = Record<string, string | Blob>
export type FexiosPostFormAnyInput = FexiosPostFormInput | FexiosPostFormRecord

declare module '@/index.js' {
  interface Fexios {
    /**
     * Post a form with a simpler API.
     *
     * - Accepts `FormData` directly.
     * - In browsers, also accepts `HTMLFormElement` and converts it via `new FormData(form)`.
     */
    postForm: <T = any>(
      url: string | URL,
      form: FexiosPostFormAnyInput,
      options?: Partial<FexiosRequestOptions>
    ) => Promise<FexiosFinalContext<T>>
  }
}

function isHTMLFormElement(x: any): x is HTMLFormElement {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as any).HTMLFormElement !== 'undefined' &&
    x instanceof (globalThis as any).HTMLFormElement
  )
}

function isPostFormRecord(x: any): x is FexiosPostFormRecord {
  // Only accept plain object to avoid treating class instances as form records.
  // FormData / HTMLFormElement are handled above.
  return isPlainObject(x)
}

function toFormData(input: FexiosPostFormAnyInput): FormData {
  if (input instanceof FormData) return input
  if (isHTMLFormElement(input)) return new FormData(input)
  if (isPostFormRecord(input)) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(input)) {
      if (v instanceof Blob) {
        // If it's a File, keep its filename when possible.
        const filename = (v as any)?.name
        if (typeof filename === 'string' && filename) {
          fd.append(k, v, filename)
        } else {
          fd.append(k, v)
        }
      } else {
        fd.append(k, String(v))
      }
    }
    return fd
  }
  throw new TypeError(
    'postForm() expects FormData / HTMLFormElement / Record<string, string | Blob>'
  )
}

export const pluginPostForm: FexiosPlugin = {
  name: 'fexios-plugin-post-form',
  install(fx) {
    fx.postForm = async (url, form, options) => {
      const body = toFormData(form)

      // NOTE:
      // Do NOT set `Content-Type` manually for FormData. Core will keep it unset
      // so the runtime can attach correct multipart boundary automatically.
      return fx.post(url, body, options)
    }

    return fx
  },
  uninstall(fx) {
    fx.postForm = undefined as any
  },
}

/**
 * Static utility class for building URL search parameters
 *
 * @example
 * { foo: 'bar', baz: ['qux', 'quux'] } // ?foo=bar&baz=qux&baz=quux
 * @example
 * { 'foo[]': 'bar', 'baz[]': ['qux', 'quux'] } // ?foo[]=bar&baz[]=qux&baz[]=quux
 */
export class FexiosQueryBuilder {
  /**
   * Build URLSearchParams from a record object with proper array handling
   * @param query - The query object containing key-value pairs
   * @returns URLSearchParams instance
   */
  static makeSearchParams(query: Record<string, any>): URLSearchParams {
    const searchParams = new URLSearchParams()

    Object.entries(query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // For array values, add multiple entries with the same key
        // This works for both regular keys and keys ending with '[]'
        value.forEach((v) => searchParams.append(key, String(v)))
      } else {
        searchParams.set(key, String(value))
      }
    })

    return searchParams
  }

  /**
   * Build query string from a record object with proper array handling
   * @param query - The query object containing key-value pairs
   * @returns URL-encoded query string
   */
  static makeQueryString(query: Record<string, any>): string {
    return this.makeSearchParams(query).toString()
  }
}

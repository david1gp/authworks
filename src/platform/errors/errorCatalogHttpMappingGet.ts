import { errorCatalogGet } from "./errorCatalogGet.js"

export function errorCatalogHttpMappingGet(code: string): { httpStatus: number; retryable: boolean } {
  const entry = errorCatalogGet(code)
  if (entry === undefined) return { httpStatus: 500, retryable: false }
  return { httpStatus: entry.httpStatus, retryable: entry.retryable }
}

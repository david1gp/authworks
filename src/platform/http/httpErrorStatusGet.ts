import { errorCatalogHttpMappingGet } from "../errors/errorCatalogHttpMappingGet.js"

const legacyStatusByErrorCode: Record<string, number> = {
  bad_request: 400,
  conflict: 409,
  forbidden: 403,
  internal_server_error: 500,
  not_found: 404,
  rate_limited: 429,
  service_unavailable: 503,
  unauthorized: 401,
}

export function httpErrorStatusGet(code: string): number {
  return legacyStatusByErrorCode[code] ?? errorCatalogHttpMappingGet(code).httpStatus
}

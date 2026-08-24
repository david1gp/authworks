import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const wahaErrorCatalog = [
  { code: "waha.invalid", httpStatus: 400, retryable: false },
  { code: "waha.not-found", httpStatus: 404, retryable: false },
  { code: "waha.conflict", httpStatus: 409, retryable: false },
  { code: "waha.read-failed", httpStatus: 500, retryable: false },
  { code: "waha.write-failed", httpStatus: 500, retryable: false },
  { code: "waha.health-failed", httpStatus: 503, retryable: true },
  { code: "waha.delivery-failed", httpStatus: 503, retryable: true },
  { code: "waha.no-healthy-candidate", httpStatus: 503, retryable: true },
  { code: "waha.internal", httpStatus: 500, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const eventsErrorCatalog = [
  { code: "events.tenant-required", httpStatus: 400, retryable: false },
  { code: "events.tenant-mismatch", httpStatus: 404, retryable: false },
  { code: "events.invalid", httpStatus: 400, retryable: false },
  { code: "events.unauthorized", httpStatus: 401, retryable: false },
  { code: "events.forbidden", httpStatus: 403, retryable: false },
  { code: "events.read-failed", httpStatus: 503, retryable: true },
  { code: "events.write-failed", httpStatus: 503, retryable: true },
  { code: "events.internal", httpStatus: 500, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const sessionsErrorCatalog = [
  { code: "sessions.not-found", httpStatus: 404, retryable: false },
  { code: "sessions.unauthorized", httpStatus: 401, retryable: false },
  { code: "sessions.forbidden", httpStatus: 403, retryable: false },
  { code: "sessions.invalid", httpStatus: 400, retryable: false },
  { code: "sessions.invalid-timestamp", httpStatus: 400, retryable: false },
  { code: "sessions.conflict", httpStatus: 409, retryable: false },
  { code: "sessions.not-active", httpStatus: 409, retryable: false },
  { code: "sessions.read-failed", httpStatus: 500, retryable: false },
  { code: "sessions.write-failed", httpStatus: 500, retryable: false },
  { code: "sessions.event-invalid", httpStatus: 500, retryable: false },
  { code: "sessions.authentication-required", httpStatus: 401, retryable: false },
  { code: "sessions.tenant-required", httpStatus: 400, retryable: false },
  { code: "sessions.tenant-mismatch", httpStatus: 404, retryable: false },
  { code: "sessions.assurance-required", httpStatus: 403, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

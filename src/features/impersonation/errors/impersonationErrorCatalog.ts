import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const impersonationErrorCatalog = [
  { code: "impersonation.not-found", httpStatus: 404, retryable: false },
  { code: "impersonation.unauthorized", httpStatus: 401, retryable: false },
  { code: "impersonation.forbidden", httpStatus: 403, retryable: false },
  { code: "impersonation.invalid", httpStatus: 400, retryable: false },
  { code: "impersonation.invalid-timestamp", httpStatus: 400, retryable: false },
  { code: "impersonation.conflict", httpStatus: 409, retryable: false },
  { code: "impersonation.not-active", httpStatus: 409, retryable: false },
  { code: "impersonation.read-failed", httpStatus: 500, retryable: false },
  { code: "impersonation.write-failed", httpStatus: 500, retryable: false },
  { code: "impersonation.event-invalid", httpStatus: 500, retryable: false },
  { code: "impersonation.authentication-required", httpStatus: 401, retryable: false },
  { code: "impersonation.tenant-mismatch", httpStatus: 404, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

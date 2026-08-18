import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const mfaErrorCatalog = [
  { code: "mfa.not-found", httpStatus: 404, retryable: false },
  { code: "mfa.unauthorized", httpStatus: 401, retryable: false },
  { code: "mfa.forbidden", httpStatus: 403, retryable: false },
  { code: "mfa.invalid", httpStatus: 400, retryable: false },
  { code: "mfa.invalid-timestamp", httpStatus: 400, retryable: false },
  { code: "mfa.conflict", httpStatus: 409, retryable: false },
  { code: "mfa.already-exists", httpStatus: 409, retryable: false },
  { code: "mfa.not-active", httpStatus: 409, retryable: false },
  { code: "mfa.read-failed", httpStatus: 500, retryable: false },
  { code: "mfa.write-failed", httpStatus: 500, retryable: false },
  { code: "mfa.event-invalid", httpStatus: 500, retryable: false },
  { code: "mfa.authentication-required", httpStatus: 401, retryable: false },
  { code: "mfa.tenant-required", httpStatus: 400, retryable: false },
  { code: "mfa.tenant-mismatch", httpStatus: 404, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

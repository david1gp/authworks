import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const passwordsErrorCatalog = [
  { code: "passwords.not-found", httpStatus: 404, retryable: false },
  { code: "passwords.unauthorized", httpStatus: 401, retryable: false },
  { code: "passwords.forbidden", httpStatus: 403, retryable: false },
  { code: "passwords.invalid", httpStatus: 400, retryable: false },
  { code: "passwords.policy-rejected", httpStatus: 400, retryable: false },
  { code: "passwords.invalid-timestamp", httpStatus: 400, retryable: false },
  { code: "passwords.conflict", httpStatus: 409, retryable: false },
  { code: "passwords.whatsapp-unavailable", httpStatus: 503, retryable: true },
  { code: "passwords.already-exists", httpStatus: 409, retryable: false },
  { code: "passwords.not-active", httpStatus: 409, retryable: false },
  { code: "passwords.read-failed", httpStatus: 500, retryable: false },
  { code: "passwords.write-failed", httpStatus: 500, retryable: false },
  { code: "passwords.event-invalid", httpStatus: 500, retryable: false },
  { code: "passwords.authentication-required", httpStatus: 401, retryable: false },
  { code: "passwords.tenant-required", httpStatus: 400, retryable: false },
  { code: "passwords.tenant-mismatch", httpStatus: 404, retryable: false },
  { code: "passwords.rate-limited", httpStatus: 429, retryable: true },
] as const satisfies readonly ErrorCatalogEntry[]

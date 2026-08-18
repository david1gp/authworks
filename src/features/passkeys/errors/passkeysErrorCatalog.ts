import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const passkeysErrorCatalog = [
  { code: "passkeys.not-found", httpStatus: 404, retryable: false },
  { code: "passkeys.unauthorized", httpStatus: 401, retryable: false },
  { code: "passkeys.forbidden", httpStatus: 403, retryable: false },
  { code: "passkeys.invalid", httpStatus: 400, retryable: false },
  { code: "passkeys.invalid-timestamp", httpStatus: 400, retryable: false },
  { code: "passkeys.conflict", httpStatus: 409, retryable: false },
  { code: "passkeys.already-exists", httpStatus: 409, retryable: false },
  { code: "passkeys.not-active", httpStatus: 409, retryable: false },
  { code: "passkeys.read-failed", httpStatus: 500, retryable: false },
  { code: "passkeys.write-failed", httpStatus: 500, retryable: false },
  { code: "passkeys.event-invalid", httpStatus: 500, retryable: false },
  { code: "passkeys.authentication-required", httpStatus: 401, retryable: false },
  { code: "passkeys.tenant-required", httpStatus: 400, retryable: false },
  { code: "passkeys.tenant-mismatch", httpStatus: 404, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

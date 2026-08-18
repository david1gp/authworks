import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const machineUsersErrorCatalog = [
  { code: "machine-users.not-found", httpStatus: 404, retryable: false },
  { code: "machine-users.unauthorized", httpStatus: 401, retryable: false },
  { code: "machine-users.forbidden", httpStatus: 403, retryable: false },
  { code: "machine-users.invalid", httpStatus: 400, retryable: false },
  { code: "machine-users.invalid-timestamp", httpStatus: 400, retryable: false },
  { code: "machine-users.conflict", httpStatus: 409, retryable: false },
  { code: "machine-users.already-exists", httpStatus: 409, retryable: false },
  { code: "machine-users.not-active", httpStatus: 409, retryable: false },
  { code: "machine-users.read-failed", httpStatus: 500, retryable: false },
  { code: "machine-users.write-failed", httpStatus: 500, retryable: false },
  { code: "machine-users.event-invalid", httpStatus: 500, retryable: false },
  { code: "machine-users.authentication-required", httpStatus: 401, retryable: false },
  { code: "machine-users.tenant-required", httpStatus: 400, retryable: false },
  { code: "machine-users.tenant-mismatch", httpStatus: 404, retryable: false },
  { code: "machine-users.invalid-client", httpStatus: 401, retryable: false },
  { code: "machine-users.invalid-scope", httpStatus: 400, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

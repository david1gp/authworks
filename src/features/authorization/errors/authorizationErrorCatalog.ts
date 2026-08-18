import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const authorizationErrorCatalog = [
  { code: "authorization.not-found", httpStatus: 404, retryable: false },
  { code: "authorization.unauthorized", httpStatus: 401, retryable: false },
  { code: "authorization.forbidden", httpStatus: 403, retryable: false },
  { code: "authorization.invalid", httpStatus: 400, retryable: false },
  { code: "authorization.conflict", httpStatus: 409, retryable: false },
  { code: "authorization.not-active", httpStatus: 409, retryable: false },
  { code: "authorization.read-failed", httpStatus: 500, retryable: false },
  { code: "authorization.write-failed", httpStatus: 500, retryable: false },
  { code: "authorization.event-invalid", httpStatus: 500, retryable: false },
  { code: "authorization.authentication-required", httpStatus: 401, retryable: false },
  { code: "authorization.tenant-mismatch", httpStatus: 404, retryable: false },
  { code: "authorization.organization-mismatch", httpStatus: 404, retryable: false },
  { code: "authorization.insufficient-assurance", httpStatus: 403, retryable: false },
  { code: "authorization.impersonation-forbidden", httpStatus: 403, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

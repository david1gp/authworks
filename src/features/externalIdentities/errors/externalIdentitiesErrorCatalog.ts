import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const externalIdentitiesErrorCatalog = [
  { code: "external-identities.not-found", httpStatus: 404, retryable: false },
  { code: "external-identities.unauthorized", httpStatus: 401, retryable: false },
  { code: "external-identities.forbidden", httpStatus: 403, retryable: false },
  { code: "external-identities.invalid", httpStatus: 400, retryable: false },
  { code: "external-identities.invalid-timestamp", httpStatus: 400, retryable: false },
  { code: "external-identities.conflict", httpStatus: 409, retryable: false },
  { code: "external-identities.already-exists", httpStatus: 409, retryable: false },
  { code: "external-identities.not-active", httpStatus: 409, retryable: false },
  { code: "external-identities.read-failed", httpStatus: 500, retryable: false },
  { code: "external-identities.write-failed", httpStatus: 500, retryable: false },
  { code: "external-identities.event-invalid", httpStatus: 500, retryable: false },
  { code: "external-identities.authentication-required", httpStatus: 401, retryable: false },
  { code: "external-identities.tenant-required", httpStatus: 400, retryable: false },
  { code: "external-identities.tenant-mismatch", httpStatus: 404, retryable: false },
  { code: "external-identities.empty-patch", httpStatus: 400, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const zitadelMigrationErrorCatalog = [
  { code: "zitadel-migration.credentials-required", httpStatus: 401, retryable: false },
  { code: "zitadel-migration.invalid", httpStatus: 400, retryable: false },
  { code: "zitadel-migration.realm-invalid", httpStatus: 404, retryable: false },
  { code: "zitadel-migration.snapshot-invalid", httpStatus: 400, retryable: false },
  { code: "zitadel-migration.source-invalid", httpStatus: 503, retryable: false },
  { code: "zitadel-migration.source-request-failed", httpStatus: 503, retryable: true },
  { code: "zitadel-migration.source-unavailable", httpStatus: 503, retryable: true },
] as const satisfies readonly ErrorCatalogEntry[]

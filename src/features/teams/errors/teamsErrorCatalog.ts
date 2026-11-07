import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const teamsErrorCatalog = [
  { code: "teams.invalid", httpStatus: 400, retryable: false },
  { code: "teams.empty-patch", httpStatus: 400, retryable: false },
  { code: "teams.invalid-timestamp", httpStatus: 400, retryable: false },
  { code: "teams.tenant-mismatch", httpStatus: 404, retryable: false },
  { code: "teams.unauthorized", httpStatus: 401, retryable: false },
  { code: "teams.forbidden", httpStatus: 403, retryable: false },
  { code: "teams.not-member", httpStatus: 403, retryable: false },
  { code: "teams.not-found", httpStatus: 404, retryable: false },
  { code: "teams.slug-conflict", httpStatus: 409, retryable: false },
  { code: "teams.name-conflict", httpStatus: 409, retryable: false },
  { code: "teams.leader-conflict", httpStatus: 409, retryable: false },
  { code: "teams.read-failed", httpStatus: 500, retryable: false },
  { code: "teams.write-failed", httpStatus: 500, retryable: false },
  { code: "teams.event-invalid", httpStatus: 500, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

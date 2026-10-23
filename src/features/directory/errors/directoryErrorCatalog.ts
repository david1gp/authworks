import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const directoryErrorCatalog = [
  { code: "directory.invalid", httpStatus: 400, retryable: false },
  { code: "directory.forbidden", httpStatus: 403, retryable: false },
  { code: "directory.not-found", httpStatus: 404, retryable: false },
  { code: "directory.read-failed", httpStatus: 500, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

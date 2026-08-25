import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const accountErrorCatalog = [
  { code: "account.invalid", httpStatus: 400, retryable: false },
  { code: "account.unauthorized", httpStatus: 401, retryable: false },
  { code: "account.forbidden", httpStatus: 403, retryable: false },
  { code: "account.read-failed", httpStatus: 503, retryable: true },
] as const satisfies readonly ErrorCatalogEntry[]

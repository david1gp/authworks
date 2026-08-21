import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const emailErrorCatalog = [
  { code: "email.invalid", httpStatus: 400, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

import type { ErrorCatalogEntry } from "./errorCatalogEntrySchema.js"

export const platformErrorCatalog = [
  { code: "platform.internal", httpStatus: 500, retryable: false },
  { code: "platform.invalid", httpStatus: 400, retryable: false },
  { code: "platform.invalid-error-code", httpStatus: 500, retryable: false },
  { code: "platform.unreachable", httpStatus: 503, retryable: true },
  { code: "platform.invalid-response", httpStatus: 500, retryable: false },
  { code: "platform.http", httpStatus: 500, retryable: false },
  { code: "platform.configuration-invalid", httpStatus: 400, retryable: false },
  { code: "platform.empty-patch", httpStatus: 400, retryable: false },
  { code: "platform.invalid-page", httpStatus: 400, retryable: false },
  { code: "platform.invalid-cursor", httpStatus: 400, retryable: false },
  { code: "platform.not-found", httpStatus: 404, retryable: false },
  { code: "platform.unauthorized", httpStatus: 401, retryable: false },
  { code: "platform.forbidden", httpStatus: 403, retryable: false },
  { code: "platform.conflict", httpStatus: 409, retryable: false },
  { code: "platform.rate-limited", httpStatus: 429, retryable: true },
  { code: "platform.unavailable", httpStatus: 503, retryable: true },
] as const satisfies readonly ErrorCatalogEntry[]

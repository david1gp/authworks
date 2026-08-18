import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const emailOtpErrorCatalog = [
  { code: "email-otp.invalid", httpStatus: 400, retryable: false },
  { code: "email-otp.unauthorized", httpStatus: 401, retryable: false },
  { code: "email-otp.forbidden", httpStatus: 403, retryable: false },
  { code: "email-otp.not-found", httpStatus: 404, retryable: false },
  { code: "email-otp.conflict", httpStatus: 409, retryable: false },
  { code: "email-otp.read-failed", httpStatus: 500, retryable: false },
  { code: "email-otp.write-failed", httpStatus: 500, retryable: false },
  { code: "email-otp.rate-limited", httpStatus: 429, retryable: true },
  { code: "email-otp.internal", httpStatus: 500, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

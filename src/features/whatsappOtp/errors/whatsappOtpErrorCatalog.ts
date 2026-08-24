import type { ErrorCatalogEntry } from "../../../platform/errors/errorCatalogEntrySchema.js"

export const whatsappOtpErrorCatalog = [
  { code: "whatsapp-otp.invalid", httpStatus: 400, retryable: false },
  { code: "whatsapp-otp.not-found", httpStatus: 404, retryable: false },
  { code: "whatsapp-otp.conflict", httpStatus: 409, retryable: false },
  { code: "whatsapp-otp.unavailable", httpStatus: 503, retryable: true },
  { code: "whatsapp-otp.rate-limited", httpStatus: 429, retryable: true },
  { code: "whatsapp-otp.read-failed", httpStatus: 500, retryable: false },
  { code: "whatsapp-otp.write-failed", httpStatus: 500, retryable: false },
  { code: "whatsapp-otp.internal", httpStatus: 500, retryable: false },
] as const satisfies readonly ErrorCatalogEntry[]

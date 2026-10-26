import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"

/**
 * Login-relevant server error codes mapped to catalog keys. Only codes whose meaning is stable
 * across every login screen that can produce them are mapped; everything else falls back to the
 * raw server `errorMessage` (today's behavior).
 *
 * Enumerated from the feature catalogs (`passwords`, `email-otp`, `whatsapp-otp`, `mfa`,
 * `sessions`); deliberately unmapped:
 * - `passwords.invalid`, `email-otp.invalid`, `whatsapp-otp.invalid`: start-vs-verify ambiguous —
 *   a malformed send request and a wrong verification code share the code, so no single key fits.
 * - `passwords.conflict`, `email-otp.conflict`, `whatsapp-otp.conflict/not-found/unavailable`,
 *   `mfa.*` (other than below), `sessions.*`: flow-specific or configuration errors where the raw
 *   server message carries the actionable detail.
 */
const loginServerErrorKeys: Readonly<Record<string, MessageKey>> = {
  "email-otp.rate-limited": "login.error.rateLimited",
  "email-otp.unauthorized": "login.error.codeInvalid",
  "mfa.factor-disabled": "login.mfa.factorUnavailable",
  "mfa.factor-unavailable": "login.mfa.factorUnavailable",
  "mfa.unauthorized": "login.error.codeInvalid",
  "passwords.policy-rejected": "login.recovery.policyRejected",
  "passwords.rate-limited": "login.error.rateLimited",
  "passwords.unauthorized": "login.error.credentialsInvalid",
  "whatsapp-otp.rate-limited": "login.error.rateLimited",
}

export function loginServerErrorKeyGet(code: string | undefined): MessageKey | undefined {
  if (code === undefined) return undefined
  return loginServerErrorKeys[code]
}

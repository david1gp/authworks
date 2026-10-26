import * as v from "valibot"

/** Canonical public factor vocabulary used by security policy contracts. */
export const mfaFactorSchema = v.picklist(["totp", "email_otp", "passkey", "recovery_code"])

export type MfaFactor = v.InferOutput<typeof mfaFactorSchema>

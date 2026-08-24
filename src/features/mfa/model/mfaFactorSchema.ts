import * as v from "valibot"

export const mfaFactorSchema = v.picklist(["email-otp", "passkey", "recovery-code", "totp"])

export type MfaFactor = v.InferOutput<typeof mfaFactorSchema>

import * as v from "valibot"

export const mfaFactorSchema = v.picklist(["totp", "email_otp", "passkey", "recovery_code"])

export type MfaFactor = v.InferOutput<typeof mfaFactorSchema>

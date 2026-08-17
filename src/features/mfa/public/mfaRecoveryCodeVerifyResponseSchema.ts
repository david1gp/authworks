import * as v from "valibot"

export const mfaRecoveryCodeVerifyResponseSchema = v.strictObject({
  method: v.literal("recovery_code"),
  verified: v.literal(true),
})

export type MfaRecoveryCodeVerifyResponse = v.InferOutput<typeof mfaRecoveryCodeVerifyResponseSchema>

import * as v from "valibot"

export const mfaTotpVerifyResponseSchema = v.strictObject({
  method: v.literal("totp"),
  verified: v.literal(true),
})

export type MfaTotpVerifyResponse = v.InferOutput<typeof mfaTotpVerifyResponseSchema>

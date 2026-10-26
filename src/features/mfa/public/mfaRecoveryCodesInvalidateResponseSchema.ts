import * as v from "valibot"

export const mfaRecoveryCodesInvalidateResponseSchema = v.strictObject({
  invalidated: v.literal(true),
  invalidatedCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type MfaRecoveryCodesInvalidateResponse = v.InferOutput<typeof mfaRecoveryCodesInvalidateResponseSchema>

import * as v from "valibot"

export const mfaRecoveryCodesResponseSchema = v.strictObject({
  codes: v.pipe(v.array(v.pipe(v.string(), v.minLength(8))), v.minLength(1)),
  generatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type MfaRecoveryCodesResponse = v.InferOutput<typeof mfaRecoveryCodesResponseSchema>

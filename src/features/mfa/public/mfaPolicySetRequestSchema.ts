import * as v from "valibot"

export const mfaPolicySetRequestSchema = v.strictObject({
  lockoutDurationMs: v.pipe(v.number(), v.integer(), v.minValue(1)),
  maxAttempts: v.pipe(v.number(), v.integer(), v.minValue(1)),
  mode: v.picklist(["disabled", "optional", "required"]),
  totpWindow: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(2)),
})

export type MfaPolicySetRequest = v.InferOutput<typeof mfaPolicySetRequestSchema>

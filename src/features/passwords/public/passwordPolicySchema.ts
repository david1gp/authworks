import * as v from "valibot"

export const passwordPolicySchema = v.strictObject({
  minimumLength: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(72)),
  requireLowercase: v.boolean(),
  requireUppercase: v.boolean(),
  requireNumber: v.boolean(),
  requireSymbol: v.boolean(),
  maximumAttempts: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
  lockoutDurationMs: v.pipe(v.number(), v.integer(), v.minValue(1_000), v.maxValue(31_536_000_000)),
})

export type PasswordPolicy = v.InferOutput<typeof passwordPolicySchema>

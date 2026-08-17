import * as v from "valibot"

export const impersonationStartRequestSchema = v.strictObject({
  durationSeconds: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(900)),
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
  reason: v.pipe(v.string(), v.trim(), v.minLength(3), v.maxLength(256)),
  targetUserId: v.pipe(v.string(), v.minLength(1)),
})

export type ImpersonationStartRequest = v.InferOutput<typeof impersonationStartRequestSchema>

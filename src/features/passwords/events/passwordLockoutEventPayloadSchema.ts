import * as v from "valibot"

export const passwordLockoutEventPayloadSchema = v.strictObject({
  attempts: v.pipe(v.number(), v.integer(), v.minValue(0)),
  lockedUntil: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type PasswordLockoutEventPayload = v.InferOutput<typeof passwordLockoutEventPayloadSchema>

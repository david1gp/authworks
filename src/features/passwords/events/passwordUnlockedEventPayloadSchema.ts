import * as v from "valibot"

export const passwordUnlockedEventPayloadSchema = v.strictObject({
  unlockedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type PasswordUnlockedEventPayload = v.InferOutput<typeof passwordUnlockedEventPayloadSchema>

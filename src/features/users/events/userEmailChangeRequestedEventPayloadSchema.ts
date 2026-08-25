import * as v from "valibot"

export const userEmailChangeRequestedEventPayloadSchema = v.strictObject({
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type UserEmailChangeRequestedEventPayload = v.InferOutput<typeof userEmailChangeRequestedEventPayloadSchema>

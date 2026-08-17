import * as v from "valibot"

export const sessionRevokedEventPayloadSchema = v.strictObject({
  reason: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  revokedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  sessionId: v.pipe(v.string(), v.minLength(1)),
})

export type SessionRevokedEventPayload = v.InferOutput<typeof sessionRevokedEventPayloadSchema>

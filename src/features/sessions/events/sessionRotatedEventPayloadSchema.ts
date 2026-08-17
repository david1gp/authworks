import * as v from "valibot"

export const sessionRotatedEventPayloadSchema = v.strictObject({
  rotatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  sessionId: v.pipe(v.string(), v.minLength(1)),
})

export type SessionRotatedEventPayload = v.InferOutput<typeof sessionRotatedEventPayloadSchema>

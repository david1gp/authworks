import * as v from "valibot"

export const impersonationEndedEventPayloadSchema = v.strictObject({
  actorId: v.pipe(v.string(), v.minLength(1)),
  endedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  endedById: v.pipe(v.string(), v.minLength(1)),
  instanceId: v.pipe(v.string(), v.minLength(1)),
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
  sessionId: v.pipe(v.string(), v.minLength(1)),
  subjectId: v.pipe(v.string(), v.minLength(1)),
})

export type ImpersonationEndedEventPayload = v.InferOutput<typeof impersonationEndedEventPayloadSchema>

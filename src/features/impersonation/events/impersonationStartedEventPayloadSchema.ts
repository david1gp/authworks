import * as v from "valibot"
import { sessionAssuranceSchema } from "../../sessions/public/sessionAssuranceSchema.js"

export const impersonationStartedEventPayloadSchema = v.strictObject({
  actorId: v.pipe(v.string(), v.minLength(1)),
  assurance: sessionAssuranceSchema,
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  instanceId: v.pipe(v.string(), v.minLength(1)),
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
  reason: v.pipe(v.string(), v.minLength(3), v.maxLength(256)),
  sessionId: v.pipe(v.string(), v.minLength(1)),
  subjectId: v.pipe(v.string(), v.minLength(1)),
})

export type ImpersonationStartedEventPayload = v.InferOutput<typeof impersonationStartedEventPayloadSchema>

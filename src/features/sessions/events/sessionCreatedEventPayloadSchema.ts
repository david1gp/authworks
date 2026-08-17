import * as v from "valibot"
import { sessionAssuranceSchema } from "../public/sessionAssuranceSchema.js"
import { sessionAuthenticationMethodSchema } from "../public/sessionAuthenticationMethodSchema.js"
import { sessionDeviceMetadataSchema } from "../public/sessionDeviceMetadataSchema.js"
import { sessionMfaMethodSchema } from "../public/sessionMfaMethodSchema.js"

export const sessionCreatedEventPayloadSchema = v.strictObject({
  assurance: sessionAssuranceSchema,
  authenticationMethod: sessionAuthenticationMethodSchema,
  device: sessionDeviceMetadataSchema,
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  impersonationOrganizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
  impersonationReason: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(256))),
  impersonatorId: v.optional(v.pipe(v.string(), v.minLength(1))),
  mfaMethod: v.optional(sessionMfaMethodSchema),
  sessionId: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type SessionCreatedEventPayload = v.InferOutput<typeof sessionCreatedEventPayloadSchema>

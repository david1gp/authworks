import * as v from "valibot"
import { sessionAssuranceSchema } from "../public/sessionAssuranceSchema.js"
import { sessionAuthenticationMethodSchema } from "../public/sessionAuthenticationMethodSchema.js"
import { sessionDeviceMetadataSchema } from "../public/sessionDeviceMetadataSchema.js"

export const sessionCreatedEventPayloadSchema = v.strictObject({
  assurance: sessionAssuranceSchema,
  authenticationMethod: sessionAuthenticationMethodSchema,
  device: sessionDeviceMetadataSchema,
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  sessionId: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type SessionCreatedEventPayload = v.InferOutput<typeof sessionCreatedEventPayloadSchema>

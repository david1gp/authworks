import * as v from "valibot"
import { sessionAssuranceSchema } from "./sessionAssuranceSchema.js"
import { sessionAuthenticationMethodSchema } from "./sessionAuthenticationMethodSchema.js"
import { sessionMeDeviceMetadataSchema } from "./sessionMeDeviceMetadataSchema.js"
import { sessionMfaMethodSchema } from "./sessionMfaMethodSchema.js"

export const sessionMeSchema = v.strictObject({
  assurance: sessionAssuranceSchema,
  authenticationMethod: sessionAuthenticationMethodSchema,
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  current: v.boolean(),
  device: sessionMeDeviceMetadataSchema,
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: v.pipe(v.string(), v.minLength(1)),
  lastUsedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  mfaMethod: v.optional(sessionMfaMethodSchema),
  revokedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
})

export type SessionMe = v.InferOutput<typeof sessionMeSchema>

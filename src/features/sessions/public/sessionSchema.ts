import * as v from "valibot"
import { sessionAssuranceSchema } from "./sessionAssuranceSchema.js"
import { sessionAuthenticationMethodSchema } from "./sessionAuthenticationMethodSchema.js"
import { sessionDeviceMetadataSchema } from "./sessionDeviceMetadataSchema.js"
import { sessionMfaMethodSchema } from "./sessionMfaMethodSchema.js"

export const sessionSchema = v.strictObject({
  assurance: sessionAssuranceSchema,
  authenticationMethod: sessionAuthenticationMethodSchema,
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  current: v.boolean(),
  device: sessionDeviceMetadataSchema,
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: v.pipe(v.string(), v.minLength(1)),
  instanceId: v.pipe(v.string(), v.minLength(1)),
  lastUsedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  mfaMethod: v.optional(sessionMfaMethodSchema),
  revokedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type Session = v.InferOutput<typeof sessionSchema>

import * as v from "valibot"
import { externalIdentityProviderTypeSchema } from "./externalIdentityProviderTypeSchema.js"

export const externalIdentitySchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  displayName: v.optional(v.pipe(v.string(), v.maxLength(512))),
  email: v.optional(v.pipe(v.string(), v.maxLength(320))),
  emailVerified: v.boolean(),
  externalSubject: v.pipe(v.string(), v.minLength(1), v.maxLength(512)),
  id: v.pipe(v.string(), v.minLength(1)),
  instanceId: v.pipe(v.string(), v.minLength(1)),
  providerId: v.pipe(v.string(), v.minLength(1)),
  providerType: externalIdentityProviderTypeSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  userId: v.pipe(v.string(), v.minLength(1)),
  username: v.optional(v.pipe(v.string(), v.maxLength(512))),
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

export type ExternalIdentity = v.InferOutput<typeof externalIdentitySchema>

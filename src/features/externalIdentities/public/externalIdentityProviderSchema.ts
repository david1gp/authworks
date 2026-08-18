import * as v from "valibot"
import { externalIdentityProviderTypeSchema } from "./externalIdentityProviderTypeSchema.js"

export const externalIdentityProviderSchema = v.strictObject({
  allowAccountCreation: v.boolean(),
  clientId: v.pipe(v.string(), v.minLength(1)),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  displayName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  enabled: v.boolean(),
  id: v.pipe(v.string(), v.minLength(1)),
  realmId: v.pipe(v.string(), v.minLength(1)),
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
  redirectUri: v.pipe(v.string(), v.url()),
  scopes: v.pipe(v.array(v.pipe(v.string(), v.minLength(1))), v.maxLength(32)),
  type: externalIdentityProviderTypeSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

export type ExternalIdentityProvider = v.InferOutput<typeof externalIdentityProviderSchema>

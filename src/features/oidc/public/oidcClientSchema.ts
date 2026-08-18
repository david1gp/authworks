import * as v from "valibot"
import { oidcClientStatusSchema } from "./oidcClientStatusSchema.js"
import { oidcClientTypeSchema } from "./oidcClientTypeSchema.js"
import { oidcResourceIdSchema } from "./oidcResourceIdSchema.js"
import { oidcScopeSchema } from "./oidcScopeSchema.js"

const oidcRedirectUriSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(2048))

export const oidcClientSchema = v.strictObject({
  allowedScopes: v.pipe(v.array(oidcScopeSchema), v.minLength(1), v.maxLength(100)),
  applicationId: v.optional(oidcResourceIdSchema),
  clientType: oidcClientTypeSchema,
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: oidcResourceIdSchema,
  realmId: oidcResourceIdSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  postLogoutRedirectUris: v.pipe(v.array(oidcRedirectUriSchema), v.maxLength(100)),
  projectId: v.optional(oidcResourceIdSchema),
  redirectUris: v.pipe(v.array(oidcRedirectUriSchema), v.minLength(1), v.maxLength(100)),
  requireConsent: v.boolean(),
  status: oidcClientStatusSchema,
  trusted: v.boolean(),
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type OidcClient = v.InferOutput<typeof oidcClientSchema>

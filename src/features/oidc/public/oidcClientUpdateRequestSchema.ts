import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"
import { oidcScopeSchema } from "../domain/oidcScopeSchema.js"

const oidcRedirectUriUpdateSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(2048))

export const oidcClientUpdateRequestSchema = v.strictObject({
  allowedScopes: v.optional(v.pipe(v.array(oidcScopeSchema), v.minLength(1), v.maxLength(100))),
  applicationId: v.optional(v.nullable(oidcResourceIdSchema)),
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  postLogoutRedirectUris: v.optional(v.pipe(v.array(oidcRedirectUriUpdateSchema), v.maxLength(100))),
  projectId: v.optional(v.nullable(oidcResourceIdSchema)),
  redirectUris: v.optional(v.pipe(v.array(oidcRedirectUriUpdateSchema), v.minLength(1), v.maxLength(100))),
  requireConsent: v.optional(v.boolean()),
  trusted: v.optional(v.boolean()),
})

export type OidcClientUpdateRequest = v.InferOutput<typeof oidcClientUpdateRequestSchema>

import * as v from "valibot"
import { oidcClientTypeSchema } from "./oidcClientTypeSchema.js"
import { oidcResourceIdSchema } from "./oidcResourceIdSchema.js"
import { oidcScopeSchema } from "./oidcScopeSchema.js"

const oidcRedirectUriRequestSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(2048))

export const oidcClientCreateRequestSchema = v.strictObject({
  allowedScopes: v.optional(v.pipe(v.array(oidcScopeSchema), v.minLength(1), v.maxLength(100))),
  applicationId: v.optional(oidcResourceIdSchema),
  clientType: oidcClientTypeSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  postLogoutRedirectUris: v.optional(v.pipe(v.array(oidcRedirectUriRequestSchema), v.maxLength(100))),
  projectId: v.optional(oidcResourceIdSchema),
  redirectUris: v.pipe(v.array(oidcRedirectUriRequestSchema), v.minLength(1), v.maxLength(100)),
  requireConsent: v.optional(v.boolean()),
  trusted: v.optional(v.boolean()),
})

export type OidcClientCreateRequest = v.InferOutput<typeof oidcClientCreateRequestSchema>

import * as v from "valibot"
import { patchClearableSchemaCreate } from "../../../platform/http/patchClearableSchemaCreate.js"
import { oidcOriginSchema } from "./oidcOriginSchema.js"
import { oidcResourceIdSchema } from "./oidcResourceIdSchema.js"
import { oidcScopeSchema } from "./oidcScopeSchema.js"

const oidcRedirectUriUpdateSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(2048))

export const oidcClientUpdateRequestSchema = v.strictObject({
  allowedScopes: v.optional(v.pipe(v.array(oidcScopeSchema), v.minLength(1), v.maxLength(100))),
  accessTokenRoleAssertion: v.optional(v.boolean()),
  applicationId: patchClearableSchemaCreate(oidcResourceIdSchema),
  additionalOrigins: v.optional(v.pipe(v.array(oidcOriginSchema), v.maxLength(100))),
  idTokenUserinfoAssertion: v.optional(v.boolean()),
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  postLogoutRedirectUris: v.optional(v.pipe(v.array(oidcRedirectUriUpdateSchema), v.maxLength(100))),
  projectId: patchClearableSchemaCreate(oidcResourceIdSchema),
  redirectUris: v.optional(v.pipe(v.array(oidcRedirectUriUpdateSchema), v.minLength(1), v.maxLength(100))),
  requireConsent: v.optional(v.boolean()),
  trusted: v.optional(v.boolean()),
})

export type OidcClientUpdateRequest = v.InferOutput<typeof oidcClientUpdateRequestSchema>

import * as v from "valibot"
import { patchClearableSchemaCreate } from "../../../platform/http/patchClearableSchemaCreate.js"
import { oidcResourceIdSchema } from "./oidcResourceIdSchema.js"
import { oidcScopeSchema } from "./oidcScopeSchema.js"

const oidcRedirectUriUpdateSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(2048))

export const oidcClientUpdateRequestSchema = v.strictObject({
  allowedScopes: v.optional(v.pipe(v.array(oidcScopeSchema), v.minLength(1), v.maxLength(100))),
  applicationId: patchClearableSchemaCreate(oidcResourceIdSchema),
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  postLogoutRedirectUris: v.optional(v.pipe(v.array(oidcRedirectUriUpdateSchema), v.maxLength(100))),
  projectId: patchClearableSchemaCreate(oidcResourceIdSchema),
  redirectUris: v.optional(v.pipe(v.array(oidcRedirectUriUpdateSchema), v.minLength(1), v.maxLength(100))),
  requireConsent: v.optional(v.boolean()),
  trusted: v.optional(v.boolean()),
})

export type OidcClientUpdateRequest = v.InferOutput<typeof oidcClientUpdateRequestSchema>

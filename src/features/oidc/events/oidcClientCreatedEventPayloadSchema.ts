import * as v from "valibot"
import { oidcClientTypeSchema } from "../public/oidcClientTypeSchema.js"
import { oidcOriginSchema } from "../public/oidcOriginSchema.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"

export const oidcClientCreatedEventPayloadSchema = v.strictObject({
  allowedScopes: v.array(oidcScopeSchema),
  accessTokenRoleAssertion: v.optional(v.boolean()),
  clientType: oidcClientTypeSchema,
  additionalOrigins: v.optional(v.pipe(v.array(oidcOriginSchema), v.maxLength(100))),
  idTokenUserinfoAssertion: v.optional(v.boolean()),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  postLogoutRedirectUris: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
  redirectUris: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
  requireConsent: v.boolean(),
  trusted: v.boolean(),
})

export type OidcClientCreatedEventPayload = v.InferOutput<typeof oidcClientCreatedEventPayloadSchema>

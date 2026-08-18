import * as v from "valibot"
import { oidcClientTypeSchema } from "../public/oidcClientTypeSchema.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"

export const oidcClientCreatedEventPayloadSchema = v.strictObject({
  allowedScopes: v.array(oidcScopeSchema),
  clientType: oidcClientTypeSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  postLogoutRedirectUris: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
  redirectUris: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
  requireConsent: v.boolean(),
  trusted: v.boolean(),
})

export type OidcClientCreatedEventPayload = v.InferOutput<typeof oidcClientCreatedEventPayloadSchema>

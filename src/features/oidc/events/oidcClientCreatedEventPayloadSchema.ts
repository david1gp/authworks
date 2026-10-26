import * as v from "valibot"
import { oidcAccessTokenLifetimeSecondsSchema } from "../public/oidcAccessTokenLifetimeSecondsSchema.js"
import { oidcClientTypeSchema } from "../public/oidcClientTypeSchema.js"
import { oidcGrantTypeSchema } from "../public/oidcGrantTypeSchema.js"
import { oidcIdTokenLifetimeSecondsSchema } from "../public/oidcIdTokenLifetimeSecondsSchema.js"
import { oidcOriginSchema } from "../public/oidcOriginSchema.js"
import { oidcRefreshTokenAbsoluteLifetimeSecondsSchema } from "../public/oidcRefreshTokenAbsoluteLifetimeSecondsSchema.js"
import { oidcRefreshTokenIdleLifetimeSecondsSchema } from "../public/oidcRefreshTokenIdleLifetimeSecondsSchema.js"
import { oidcResponseTypeSchema } from "../public/oidcResponseTypeSchema.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"

export const oidcClientCreatedEventPayloadSchema = v.strictObject({
  allowedScopes: v.array(oidcScopeSchema),
  accessTokenLifetimeSeconds: v.optional(oidcAccessTokenLifetimeSecondsSchema),
  accessTokenRoleAssertion: v.optional(v.boolean()),
  clientType: oidcClientTypeSchema,
  additionalOrigins: v.optional(v.pipe(v.array(oidcOriginSchema), v.maxLength(100))),
  devMode: v.optional(v.boolean()),
  grantTypes: v.optional(v.array(oidcGrantTypeSchema)),
  idTokenLifetimeSeconds: v.optional(oidcIdTokenLifetimeSecondsSchema),
  idTokenRoleAssertion: v.optional(v.boolean()),
  idTokenUserinfoAssertion: v.optional(v.boolean()),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  postLogoutRedirectUris: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
  redirectUris: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
  refreshTokenAbsoluteLifetimeSeconds: v.optional(oidcRefreshTokenAbsoluteLifetimeSecondsSchema),
  refreshTokenIdleLifetimeSeconds: v.optional(oidcRefreshTokenIdleLifetimeSecondsSchema),
  requireConsent: v.boolean(),
  responseTypes: v.optional(v.array(oidcResponseTypeSchema)),
  trusted: v.boolean(),
})

export type OidcClientCreatedEventPayload = v.InferOutput<typeof oidcClientCreatedEventPayloadSchema>

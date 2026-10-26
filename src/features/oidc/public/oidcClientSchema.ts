import * as v from "valibot"
import { projectResourceIdSchema } from "../../projects/public/projectResourceIdSchema.js"
import { oidcAccessTokenLifetimeSecondsSchema } from "./oidcAccessTokenLifetimeSecondsSchema.js"
import { oidcClientStatusSchema } from "./oidcClientStatusSchema.js"
import { oidcClientTypeSchema } from "./oidcClientTypeSchema.js"
import { oidcGrantTypeSchema } from "./oidcGrantTypeSchema.js"
import { oidcIdTokenLifetimeSecondsSchema } from "./oidcIdTokenLifetimeSecondsSchema.js"
import { oidcOriginSchema } from "./oidcOriginSchema.js"
import { oidcRefreshTokenAbsoluteLifetimeSecondsSchema } from "./oidcRefreshTokenAbsoluteLifetimeSecondsSchema.js"
import { oidcRefreshTokenIdleLifetimeSecondsSchema } from "./oidcRefreshTokenIdleLifetimeSecondsSchema.js"
import { oidcResourceIdSchema } from "./oidcResourceIdSchema.js"
import { oidcResponseTypeSchema } from "./oidcResponseTypeSchema.js"
import { oidcScopeSchema } from "./oidcScopeSchema.js"

const oidcRedirectUriSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(2048))

export const oidcClientSchema = v.strictObject({
  allowedScopes: v.pipe(v.array(oidcScopeSchema), v.minLength(1), v.maxLength(100)),
  accessTokenLifetimeSeconds: oidcAccessTokenLifetimeSecondsSchema,
  accessTokenRoleAssertion: v.boolean(),
  applicationId: v.optional(oidcResourceIdSchema),
  clientType: oidcClientTypeSchema,
  additionalOrigins: v.pipe(v.array(oidcOriginSchema), v.maxLength(100)),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  devMode: v.boolean(),
  grantTypes: v.pipe(v.array(oidcGrantTypeSchema), v.maxLength(2)),
  id: oidcResourceIdSchema,
  idTokenLifetimeSeconds: oidcIdTokenLifetimeSecondsSchema,
  idTokenRoleAssertion: v.boolean(),
  idTokenUserinfoAssertion: v.boolean(),
  realmId: oidcResourceIdSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  postLogoutRedirectUris: v.pipe(v.array(oidcRedirectUriSchema), v.maxLength(100)),
  projectId: v.optional(projectResourceIdSchema),
  redirectUris: v.pipe(v.array(oidcRedirectUriSchema), v.minLength(1), v.maxLength(100)),
  refreshTokenAbsoluteLifetimeSeconds: oidcRefreshTokenAbsoluteLifetimeSecondsSchema,
  refreshTokenIdleLifetimeSeconds: oidcRefreshTokenIdleLifetimeSecondsSchema,
  requireConsent: v.boolean(),
  responseTypes: v.pipe(v.array(oidcResponseTypeSchema), v.maxLength(1)),
  status: oidcClientStatusSchema,
  trusted: v.boolean(),
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type OidcClient = v.InferOutput<typeof oidcClientSchema>

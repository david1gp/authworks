import * as v from "valibot"
import { patchClearableSchemaCreate } from "../../../platform/http/patchClearableSchemaCreate.js"
import { projectResourceIdSchema } from "../../projects/public/projectResourceIdSchema.js"
import { oidcAccessTokenLifetimeSecondsSchema } from "./oidcAccessTokenLifetimeSecondsSchema.js"
import { oidcClientTypeSchema } from "./oidcClientTypeSchema.js"
import { oidcGrantTypeSchema } from "./oidcGrantTypeSchema.js"
import { oidcIdTokenLifetimeSecondsSchema } from "./oidcIdTokenLifetimeSecondsSchema.js"
import { oidcOriginSchema } from "./oidcOriginSchema.js"
import { oidcRefreshTokenAbsoluteLifetimeSecondsSchema } from "./oidcRefreshTokenAbsoluteLifetimeSecondsSchema.js"
import { oidcRefreshTokenIdleLifetimeSecondsSchema } from "./oidcRefreshTokenIdleLifetimeSecondsSchema.js"
import { oidcResourceIdSchema } from "./oidcResourceIdSchema.js"
import { oidcResponseTypeSchema } from "./oidcResponseTypeSchema.js"
import { oidcScopeSchema } from "./oidcScopeSchema.js"

const oidcRedirectUriRequestSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(2048))

export const oidcClientCreateRequestSchema = v.strictObject({
  allowedScopes: v.optional(v.pipe(v.array(oidcScopeSchema), v.minLength(1), v.maxLength(100))),
  accessTokenLifetimeSeconds: patchClearableSchemaCreate(oidcAccessTokenLifetimeSecondsSchema),
  accessTokenRoleAssertion: v.optional(v.boolean()),
  applicationId: v.optional(oidcResourceIdSchema),
  clientType: oidcClientTypeSchema,
  additionalOrigins: v.optional(v.pipe(v.array(oidcOriginSchema), v.maxLength(100))),
  devMode: v.optional(v.boolean()),
  grantTypes: v.optional(v.pipe(v.array(oidcGrantTypeSchema), v.maxLength(2))),
  idTokenLifetimeSeconds: patchClearableSchemaCreate(oidcIdTokenLifetimeSecondsSchema),
  idTokenRoleAssertion: v.optional(v.boolean()),
  idTokenUserinfoAssertion: v.optional(v.boolean()),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  postLogoutRedirectUris: v.optional(v.pipe(v.array(oidcRedirectUriRequestSchema), v.maxLength(100))),
  projectId: v.optional(projectResourceIdSchema),
  redirectUris: v.pipe(v.array(oidcRedirectUriRequestSchema), v.minLength(1), v.maxLength(100)),
  refreshTokenAbsoluteLifetimeSeconds: patchClearableSchemaCreate(oidcRefreshTokenAbsoluteLifetimeSecondsSchema),
  refreshTokenIdleLifetimeSeconds: patchClearableSchemaCreate(oidcRefreshTokenIdleLifetimeSecondsSchema),
  requireConsent: v.optional(v.boolean()),
  responseTypes: v.optional(v.pipe(v.array(oidcResponseTypeSchema), v.maxLength(1))),
  trusted: v.optional(v.boolean()),
})

export type OidcClientCreateRequest = v.InferOutput<typeof oidcClientCreateRequestSchema>

import * as v from "valibot"
import { patchClearableSchemaCreate } from "../../../platform/http/patchClearableSchemaCreate.js"
import { projectResourceIdSchema } from "../../projects/public/projectResourceIdSchema.js"
import { oidcAccessTokenLifetimeSecondsSchema } from "./oidcAccessTokenLifetimeSecondsSchema.js"
import { oidcGrantTypeSchema } from "./oidcGrantTypeSchema.js"
import { oidcIdTokenLifetimeSecondsSchema } from "./oidcIdTokenLifetimeSecondsSchema.js"
import { oidcOriginSchema } from "./oidcOriginSchema.js"
import { oidcRefreshTokenAbsoluteLifetimeSecondsSchema } from "./oidcRefreshTokenAbsoluteLifetimeSecondsSchema.js"
import { oidcRefreshTokenIdleLifetimeSecondsSchema } from "./oidcRefreshTokenIdleLifetimeSecondsSchema.js"
import { oidcResourceIdSchema } from "./oidcResourceIdSchema.js"
import { oidcResponseTypeSchema } from "./oidcResponseTypeSchema.js"
import { oidcScopeSchema } from "./oidcScopeSchema.js"

const oidcRedirectUriUpdateSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(2048))

export const oidcClientUpdateRequestSchema = v.strictObject({
  allowedScopes: v.optional(v.pipe(v.array(oidcScopeSchema), v.minLength(1), v.maxLength(100))),
  accessTokenLifetimeSeconds: patchClearableSchemaCreate(oidcAccessTokenLifetimeSecondsSchema),
  accessTokenRoleAssertion: v.optional(v.boolean()),
  applicationId: patchClearableSchemaCreate(oidcResourceIdSchema),
  additionalOrigins: v.optional(v.pipe(v.array(oidcOriginSchema), v.maxLength(100))),
  devMode: v.optional(v.boolean()),
  grantTypes: v.optional(v.pipe(v.array(oidcGrantTypeSchema), v.maxLength(2))),
  idTokenLifetimeSeconds: patchClearableSchemaCreate(oidcIdTokenLifetimeSecondsSchema),
  idTokenRoleAssertion: v.optional(v.boolean()),
  idTokenUserinfoAssertion: v.optional(v.boolean()),
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  postLogoutRedirectUris: v.optional(v.pipe(v.array(oidcRedirectUriUpdateSchema), v.maxLength(100))),
  projectId: patchClearableSchemaCreate(projectResourceIdSchema),
  redirectUris: v.optional(v.pipe(v.array(oidcRedirectUriUpdateSchema), v.minLength(1), v.maxLength(100))),
  refreshTokenAbsoluteLifetimeSeconds: patchClearableSchemaCreate(oidcRefreshTokenAbsoluteLifetimeSecondsSchema),
  refreshTokenIdleLifetimeSeconds: patchClearableSchemaCreate(oidcRefreshTokenIdleLifetimeSecondsSchema),
  requireConsent: v.optional(v.boolean()),
  responseTypes: v.optional(v.pipe(v.array(oidcResponseTypeSchema), v.maxLength(1))),
  trusted: v.optional(v.boolean()),
})

export type OidcClientUpdateRequest = v.InferOutput<typeof oidcClientUpdateRequestSchema>

import * as v from "valibot"

export const authorizationActorContextSchema = v.object({
  actorId: v.pipe(v.string(), v.minLength(1)),
  assurance: v.picklist(["none", "authenticated", "multi_factor"]),
  authenticationMethod: v.picklist([
    "none",
    "system",
    "trusted",
    "bootstrap_admin",
    "client_credentials",
    "personal_access_token",
    "api_key",
    "oidc_access_token",
  ]),
  instanceId: v.optional(v.pipe(v.string(), v.minLength(1))),
  kind: v.picklist(["anonymous", "user", "bootstrap_admin", "system", "machine"]),
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
  impersonationPermissions: v.optional(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(128)))),
  impersonationSessionId: v.optional(v.pipe(v.string(), v.minLength(1))),
  impersonatorId: v.optional(v.pipe(v.string(), v.minLength(1))),
  scopes: v.optional(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(128)))),
})

export type AuthorizationActorContext = v.InferOutput<typeof authorizationActorContextSchema>

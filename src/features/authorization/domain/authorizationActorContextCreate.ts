import type { AuthorizationActorContext } from "../public/authorizationActorContextSchema.js"

type AuthorizationActorContextCreateOptions = {
  readonly actorId: string
  readonly assurance: AuthorizationActorContext["assurance"]
  readonly authenticationMethod: AuthorizationActorContext["authenticationMethod"]
  readonly instanceId?: string
  readonly impersonationPermissions?: readonly string[]
  readonly impersonationSessionId?: string
  readonly impersonatorId?: string
  readonly kind: AuthorizationActorContext["kind"]
  readonly organizationId?: string
  readonly scopes?: readonly string[]
}

export function authorizationActorContextCreate(
  options: AuthorizationActorContextCreateOptions,
): AuthorizationActorContext {
  const { impersonationPermissions, impersonationSessionId, impersonatorId, scopes, ...actor } = options
  return {
    ...actor,
    ...(impersonationPermissions === undefined ? {} : { impersonationPermissions: [...impersonationPermissions] }),
    ...(impersonationSessionId === undefined ? {} : { impersonationSessionId }),
    ...(impersonatorId === undefined ? {} : { impersonatorId }),
    ...(scopes === undefined ? {} : { scopes: [...scopes] }),
  }
}

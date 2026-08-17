import type { AuthorizationActorContext } from "../public/authorizationActorContextSchema.js"

type AuthorizationActorContextCreateOptions = {
  readonly actorId: string
  readonly assurance: AuthorizationActorContext["assurance"]
  readonly authenticationMethod: AuthorizationActorContext["authenticationMethod"]
  readonly instanceId?: string
  readonly kind: AuthorizationActorContext["kind"]
  readonly organizationId?: string
  readonly scopes?: readonly string[]
}

export function authorizationActorContextCreate(
  options: AuthorizationActorContextCreateOptions,
): AuthorizationActorContext {
  const { scopes, ...actor } = options
  return scopes === undefined ? actor : { ...actor, scopes: [...scopes] }
}

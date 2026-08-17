import type { AuthorizationActorContext } from "../public/authorizationActorContextSchema.js"

type AuthorizationActorContextCreateOptions = {
  readonly actorId: string
  readonly assurance: AuthorizationActorContext["assurance"]
  readonly authenticationMethod: AuthorizationActorContext["authenticationMethod"]
  readonly instanceId?: string
  readonly kind: AuthorizationActorContext["kind"]
  readonly organizationId?: string
}

export function authorizationActorContextCreate(
  options: AuthorizationActorContextCreateOptions,
): AuthorizationActorContext {
  return { ...options }
}

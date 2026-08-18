import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { OrganizationContext } from "./organizationContext.js"

export function organizationContextCreate(
  realmId: string,
  organizationId: string,
  actorId: string,
  actor: AuthorizationActorContext = {
    actorId,
    assurance: "authenticated",
    authenticationMethod: "trusted",
    realmId,
    kind: "user",
  },
): OrganizationContext {
  return { actor, actorId, realmId, kind: "organization", organizationId }
}

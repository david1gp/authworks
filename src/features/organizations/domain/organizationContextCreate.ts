import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { OrganizationContext } from "./organizationContext.js"

export function organizationContextCreate(
  instanceId: string,
  organizationId: string,
  actorId: string,
  actor: AuthorizationActorContext = {
    actorId,
    assurance: "authenticated",
    authenticationMethod: "trusted",
    instanceId,
    kind: "user",
  },
): OrganizationContext {
  return { actor, actorId, instanceId, kind: "organization", organizationId }
}

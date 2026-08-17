import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { InstanceTenantContext } from "./instanceTenantContext.js"

export function instanceTenantContextCreate(instanceId: string, actorId: string): InstanceTenantContext {
  const actor: AuthorizationActorContext =
    actorId === "anonymous"
      ? {
          actorId,
          assurance: "none",
          authenticationMethod: "none",
          instanceId,
          kind: "anonymous",
        }
      : {
          actorId,
          assurance: "authenticated",
          authenticationMethod: "trusted",
          instanceId,
          kind: "user",
        }
  return {
    actor,
    actorId,
    instanceId,
    kind: "tenant",
  }
}

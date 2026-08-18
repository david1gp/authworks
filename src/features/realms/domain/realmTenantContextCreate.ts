import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { RealmTenantContext } from "./realmTenantContext.js"

export function realmTenantContextCreate(realmId: string, actorId: string): RealmTenantContext {
  const actor: AuthorizationActorContext =
    actorId === "anonymous"
      ? {
          actorId,
          assurance: "none",
          authenticationMethod: "none",
          realmId: realmId,
          kind: "anonymous",
        }
      : {
          actorId,
          assurance: "authenticated",
          authenticationMethod: "trusted",
          realmId: realmId,
          kind: "user",
        }
  return {
    actor,
    actorId,
    realmId,
    kind: "tenant",
  }
}

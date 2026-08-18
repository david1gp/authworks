import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { RealmSystemContext } from "./realmSystemContext.js"

export function realmSystemContextCreate(actorId = "system"): RealmSystemContext {
  const actor: AuthorizationActorContext = {
    actorId,
    assurance: "authenticated",
    authenticationMethod: "system",
    kind: "system",
  }
  return { actor, actorId, kind: "system" }
}

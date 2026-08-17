import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import type { InstanceSystemContext } from "./instanceSystemContext.js"

export function instanceSystemContextCreate(actorId = "system"): InstanceSystemContext {
  const actor: AuthorizationActorContext = {
    actorId,
    assurance: "authenticated",
    authenticationMethod: "system",
    kind: "system",
  }
  return { actor, actorId, kind: "system" }
}

import { authorizationActorContextCreate } from "./authorizationActorContextCreate.js"

export function authorizationSystemActorContextCreate(actorId = "system") {
  return authorizationActorContextCreate({
    actorId,
    assurance: "authenticated",
    authenticationMethod: "system",
    kind: "system",
  })
}

import { authorizationActorContextCreate } from "./authorizationActorContextCreate.js"

export function authorizationAnonymousActorContextCreate(instanceId: string) {
  return authorizationActorContextCreate({
    actorId: "anonymous",
    assurance: "none",
    authenticationMethod: "none",
    instanceId,
    kind: "anonymous",
  })
}

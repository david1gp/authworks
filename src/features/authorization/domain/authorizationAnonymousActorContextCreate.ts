import { authorizationActorContextCreate } from "./authorizationActorContextCreate.js"

export function authorizationAnonymousActorContextCreate(realmId: string) {
  return authorizationActorContextCreate({
    actorId: "anonymous",
    assurance: "none",
    authenticationMethod: "none",
    realmId,
    kind: "anonymous",
  })
}

import { authorizationActorContextCreate } from "./authorizationActorContextCreate.js"

export function authorizationBootstrapAdminActorContextCreate(realmId: string, actorId: string) {
  return authorizationActorContextCreate({
    actorId,
    assurance: "authenticated",
    authenticationMethod: "bootstrap_admin",
    realmId,
    kind: "bootstrap_admin",
  })
}

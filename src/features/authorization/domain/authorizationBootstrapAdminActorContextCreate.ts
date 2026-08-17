import { authorizationActorContextCreate } from "./authorizationActorContextCreate.js"

export function authorizationBootstrapAdminActorContextCreate(instanceId: string, actorId: string) {
  return authorizationActorContextCreate({
    actorId,
    assurance: "authenticated",
    authenticationMethod: "bootstrap_admin",
    instanceId,
    kind: "bootstrap_admin",
  })
}

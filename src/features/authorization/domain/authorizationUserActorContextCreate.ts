import { authorizationActorContextCreate } from "./authorizationActorContextCreate.js"

export function authorizationUserActorContextCreate(realmId: string, actorId: string, organizationId?: string) {
  return authorizationActorContextCreate({
    actorId,
    assurance: "authenticated",
    authenticationMethod: "trusted",
    realmId,
    kind: "user",
    ...(organizationId === undefined ? {} : { organizationId }),
  })
}

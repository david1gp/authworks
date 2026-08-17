import { authorizationActorContextCreate } from "./authorizationActorContextCreate.js"

export function authorizationUserActorContextCreate(instanceId: string, actorId: string, organizationId?: string) {
  return authorizationActorContextCreate({
    actorId,
    assurance: "authenticated",
    authenticationMethod: "trusted",
    instanceId,
    kind: "user",
    ...(organizationId === undefined ? {} : { organizationId }),
  })
}

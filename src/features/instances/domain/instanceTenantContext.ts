import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"

export type InstanceTenantContext = {
  readonly actor: AuthorizationActorContext
  readonly actorId: string
  readonly instanceId: string
  readonly kind: "tenant"
}

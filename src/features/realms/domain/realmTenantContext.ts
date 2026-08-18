import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"

export type RealmTenantContext = {
  readonly actor: AuthorizationActorContext
  readonly actorId: string
  readonly realmId: string
  readonly kind: "tenant"
}

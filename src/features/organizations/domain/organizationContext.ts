import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"

export type OrganizationContext = {
  readonly actor: AuthorizationActorContext
  readonly actorId: string
  readonly realmId: string
  readonly kind: "organization"
  readonly organizationId: string
}

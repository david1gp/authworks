import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"

export type InstanceSystemContext = {
  readonly actor: AuthorizationActorContext
  readonly actorId: string
  readonly kind: "system"
}

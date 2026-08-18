import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"

export type RealmSystemContext = {
  readonly actor: AuthorizationActorContext
  readonly actorId: string
  readonly kind: "system"
}

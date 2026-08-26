import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { RealmTenantContext } from "../../realms/server/index.js"

export function userEmailAddressContextValidate(
  context: RealmTenantContext,
  realmId: string,
  userId: string,
): Result<void> {
  const op = "userEmailAddressContextValidate"
  if (
    context === undefined ||
    context === null ||
    context.kind !== "tenant" ||
    context.realmId !== realmId ||
    context.actor.kind !== "user" ||
    context.actor.realmId !== realmId ||
    context.actor.actorId !== userId ||
    userId.length === 0
  )
    return resultErrorCreate(
      op,
      "An authenticated user is required for the email address operation.",
      "users.forbidden",
    )
  return resultCreate(undefined)
}

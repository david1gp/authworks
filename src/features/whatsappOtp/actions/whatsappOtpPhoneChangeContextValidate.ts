import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"

export function whatsappOtpPhoneChangeContextValidate(
  context: RealmSystemContext | RealmTenantContext,
  realmId: string,
  userId: string,
): Result<void> {
  const op = "whatsappOtpPhoneChangeContextValidate"
  if (
    context === undefined ||
    context === null ||
    context.kind !== "tenant" ||
    context.realmId !== realmId ||
    context.actor.realmId !== realmId
  )
    return resultErrorCreate(
      op,
      "The account phone change is not available in this tenant context.",
      "whatsapp-otp.not-found",
    )
  if (
    context.actor.kind !== "user" ||
    context.actor.actorId !== userId ||
    context.actor.assurance === "none" ||
    userId.length === 0
  )
    return resultErrorCreate(
      op,
      "An authenticated user is required for the account phone change.",
      "whatsapp-otp.invalid",
    )
  return resultCreate(undefined)
}

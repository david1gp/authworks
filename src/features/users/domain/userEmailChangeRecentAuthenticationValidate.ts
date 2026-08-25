import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { Session } from "../../sessions/public/sessionSchema.js"

const userEmailChangeRecentAuthenticationMs = 5 * 60 * 1_000

export function userEmailChangeRecentAuthenticationValidate(
  session: Session | undefined,
  realmId: string,
  userId: string,
  now: number,
): Result<void> {
  const op = "userEmailChangeRecentAuthenticationValidate"
  if (
    session === undefined ||
    session.realmId !== realmId ||
    session.subjectType !== "user" ||
    session.subjectId !== userId ||
    !session.current ||
    session.revokedAt !== null ||
    session.assurance === "none" ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    now < session.createdAt ||
    session.expiresAt <= now ||
    now - session.createdAt > userEmailChangeRecentAuthenticationMs
  )
    return resultErrorCreate(
      op,
      "A recent authentication is required before changing the account email.",
      "users.unauthorized",
    )
  return resultCreate(undefined)
}

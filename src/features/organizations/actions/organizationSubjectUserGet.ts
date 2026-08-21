import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userRepositoryCreate } from "../../users/persistence/userRepositoryCreate.js"
import { organizationEmailNormalize } from "../domain/organizationEmailNormalize.js"

type OrganizationSubjectUserGetOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function organizationSubjectUserGet(
  options: OrganizationSubjectUserGetOptions,
): Result<{ email: string; userId: string }> {
  const op = "organizationSubjectUserGet"
  if (
    options.context.kind !== "tenant" ||
    options.context.actor.kind !== "user" ||
    options.context.actorId !== options.context.actor.actorId ||
    options.context.actor.realmId !== options.realmId ||
    options.context.realmId !== options.realmId
  )
    return resultErrorCodedCreate(
      op,
      "The authenticated user is not available in this realm.",
      "organizations.forbidden",
    )
  const user = userRepositoryCreate(options.database.db).userGet(options.realmId, options.context.actorId)
  if (!user.success)
    return resultErrorCodedCreate(op, "The authenticated user could not be read.", "organizations.read-failed")
  if (user.data === null || user.data.state !== "active")
    return resultErrorCodedCreate(
      op,
      "The authenticated user is not available in this realm.",
      "organizations.forbidden",
    )
  const email = organizationEmailNormalize(user.data.email)
  if (!email.success)
    return resultErrorCodedCreate(op, "The authenticated user email is invalid.", "organizations.read-failed")
  return resultCreate({ email: email.data, userId: user.data.id })
}

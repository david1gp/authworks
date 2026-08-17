import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { User } from "../public/userSchema.js"

type UserGetOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly userId: string
}

export function userGet(options: UserGetOptions): Result<{ user: User }> {
  const op = "userGet"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The user is not available in this tenant context.")
  const user = userRepositoryCreate(options.database.db).userGet(options.instanceId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state === "deleted") return resultErrorCreate(op, "The user was not found.")
  return resultCreate({ user: userPublicViewCreate(user.data) })
}

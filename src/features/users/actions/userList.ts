import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { userPublicViewCreate } from "../domain/userPublicViewCreate.js"
import { userRepositoryCreate } from "../persistence/userRepositoryCreate.js"
import type { User } from "../public/userSchema.js"

type UserListOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
}

export function userList(options: UserListOptions): Result<{ users: User[] }> {
  const op = "userList"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The users are not available in this tenant context.")
  const users = userRepositoryCreate(options.database.db).userList(options.instanceId)
  if (!users.success) return users
  return resultCreate({ users: users.data.map(userPublicViewCreate) })
}

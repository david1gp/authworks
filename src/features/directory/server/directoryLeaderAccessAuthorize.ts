import { type Result } from "#result"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmAdministratorIs } from "../../realms/server/index.js"
import { directoryLeaderScopeResolve } from "./directoryLeaderScopeResolve.js"

type DirectoryLeaderAccessAuthorizeOptions = {
  readonly actorId: string
  readonly database: StorageDatabase
  readonly realmId: string
  readonly targetUserId: string
}

/**
 * Shared read gate: whether an actor may read another user through team
 * leadership — the target belongs to a team the actor leads. Realm
 * administrators are never readable through this path. Callers authorize;
 * `false` means the caller keeps the denial non-privileged callers get.
 */
export function directoryLeaderAccessAuthorize(options: DirectoryLeaderAccessAuthorizeOptions): Result<boolean> {
  if (options.actorId.length === 0 || options.targetUserId.length === 0) return { data: false, success: true }
  const targetAdministrator = realmAdministratorIs({
    database: options.database,
    realmId: options.realmId,
    userId: options.targetUserId,
  })
  if (!targetAdministrator.success) return targetAdministrator
  if (targetAdministrator.data) return { data: false, success: true }
  const scope = directoryLeaderScopeResolve({
    actorId: options.actorId,
    database: options.database,
    realmId: options.realmId,
  })
  if (!scope.success) return scope
  return {
    data: scope.data.some((team) => team.memberUserIds.includes(options.targetUserId)),
    success: true,
  }
}

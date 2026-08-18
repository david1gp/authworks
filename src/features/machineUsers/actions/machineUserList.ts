import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineUserPublicViewCreate } from "../domain/machineUserPublicViewCreate.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import { machineUserContextAuthorize } from "./machineUserContextAuthorize.js"
import type { MachineUserListResponse } from "../public/machineUserListResponseSchema.js"

type MachineUserListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly query?: ListQuery
  readonly realmId: string
}

export function machineUserList(options: MachineUserListOptions): Result<MachineUserListResponse> {
  const authorized = machineUserContextAuthorize(options)
  if (!authorized.success) return authorized
  const found = machineRepositoryCreate(options.database.db).userList(options.realmId)
  if (!found.success) return found
  const machineUsers = []
  for (const row of found.data) {
    const scopes = machineScopesParse(row.scopes)
    if (!scopes.success) return scopes
    machineUsers.push(machineUserPublicViewCreate(row, scopes.data))
  }
  return listRowsPage({
    idGet: (machineUser) => machineUser.id,
    query: options.query,
    rows: machineUsers,
    sortValueGet: (machineUser) => machineUser.createdAt,
  })
}

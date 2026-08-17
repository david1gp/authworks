import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineUserPublicViewCreate } from "../domain/machineUserPublicViewCreate.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import { machineUserContextAuthorize } from "./machineUserContextAuthorize.js"
import type { MachineUserListResponse } from "../public/machineUserListResponseSchema.js"

type MachineUserListOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
}

export function machineUserList(options: MachineUserListOptions): Result<MachineUserListResponse> {
  const authorized = machineUserContextAuthorize(options)
  if (!authorized.success) return authorized
  const found = machineRepositoryCreate(options.database.db).userList(options.instanceId)
  if (!found.success) return found
  const machineUsers = []
  for (const row of found.data) {
    const scopes = machineScopesParse(row.scopes)
    if (!scopes.success) return scopes
    machineUsers.push(machineUserPublicViewCreate(row, scopes.data))
  }
  return resultCreate({ machineUsers })
}

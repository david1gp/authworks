import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { machineCredentialPublicViewCreate } from "../domain/machineCredentialPublicViewCreate.js"
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import { machineUserContextAuthorize } from "./machineUserContextAuthorize.js"
import type { MachineCredentialListResponse } from "../public/machineCredentialListResponseSchema.js"

type MachineCredentialListOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly machineUserId: string
}

export function machineCredentialList(options: MachineCredentialListOptions): Result<MachineCredentialListResponse> {
  const authorized = machineUserContextAuthorize({ ...options, permission: "machine.credential.manage" })
  if (!authorized.success) return authorized
  const found = machineRepositoryCreate(options.database.db).credentialList(options.instanceId, options.machineUserId)
  if (!found.success) return found
  const credentials = []
  for (const row of found.data) {
    const scopes = machineScopesParse(row.scopes)
    if (!scopes.success) return scopes
    credentials.push(machineCredentialPublicViewCreate(row, scopes.data))
  }
  return resultCreate({ credentials })
}

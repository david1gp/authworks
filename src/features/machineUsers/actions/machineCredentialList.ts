import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { machineCredentialPublicViewCreate } from "../domain/machineCredentialPublicViewCreate.js"
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import { machineUserContextAuthorize } from "./machineUserContextAuthorize.js"
import type { MachineCredentialListResponse } from "../public/machineCredentialListResponseSchema.js"

type MachineCredentialListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly machineUserId: string
}

export function machineCredentialList(options: MachineCredentialListOptions): Result<MachineCredentialListResponse> {
  const authorized = machineUserContextAuthorize({ ...options, permission: "machine.credential.manage" })
  if (!authorized.success) return authorized
  const found = machineRepositoryCreate(options.database.db).credentialList(options.realmId, options.machineUserId)
  if (!found.success) return found
  const credentials = []
  for (const row of found.data) {
    const scopes = machineScopesParse(row.scopes)
    if (!scopes.success) return scopes
    credentials.push(machineCredentialPublicViewCreate(row, scopes.data))
  }
  return resultCreate({ credentials })
}

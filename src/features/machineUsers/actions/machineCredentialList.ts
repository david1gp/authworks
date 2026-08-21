import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { machineCredentialPublicViewCreate } from "../domain/machineCredentialPublicViewCreate.js"
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import type { MachineCredentialListResponse } from "../public/machineCredentialListResponseSchema.js"
import { machineUserContextAuthorize } from "./machineUserContextAuthorize.js"

type MachineCredentialListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly machineUserId: string
  readonly query?: ListQuery
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
  return listRowsPage({
    idGet: (credential) => credential.id,
    query: options.query,
    rows: credentials,
    sortValueGet: (credential) => credential.createdAt,
  })
}

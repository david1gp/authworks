import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { machineScopesParse } from "../domain/machineScopesParse.js"
import { machineUserPublicViewCreate } from "../domain/machineUserPublicViewCreate.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"
import { machineUserContextAuthorize } from "./machineUserContextAuthorize.js"
import type { MachineUserResponse } from "../public/machineUserResponseSchema.js"

type MachineUserGetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly machineUserId: string
}

export function machineUserGet(options: MachineUserGetOptions): Result<MachineUserResponse> {
  const authorized = machineUserContextAuthorize(options)
  if (!authorized.success) return authorized
  const found = machineRepositoryCreate(options.database.db).userGet(options.realmId, options.machineUserId)
  if (!found.success) return found
  if (found.data === null)
    return resultErrorCreate("machineUserGet", "The machine user was not found.", "machine-users.not-found")
  const scopes = machineScopesParse(found.data.scopes)
  if (!scopes.success) return scopes
  return resultCreate({ machineUser: machineUserPublicViewCreate(found.data, scopes.data) })
}

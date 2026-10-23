import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"

type MachineClientCredentialsSupportedOptions = {
  readonly database: StorageDatabase
  readonly organizationId?: string
  readonly realmId: string
}

export function machineClientCredentialsSupported(options: MachineClientCredentialsSupportedOptions): Result<boolean> {
  const repository = machineRepositoryCreate(options.database.db)
  const users =
    options.organizationId === undefined
      ? repository.userListForRealm(options.realmId)
      : repository.userList(options.realmId, options.organizationId)
  if (!users.success)
    return resultErrorCreate(
      "machineClientCredentialsSupported",
      "The machine users could not be read.",
      "machine-users.read-failed",
    )
  return resultCreate(users.data.some((user) => user.status === "active"))
}

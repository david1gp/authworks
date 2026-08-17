import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { machineRepositoryCreate } from "../persistence/machineRepositoryCreate.js"

type MachineClientCredentialsSupportedOptions = {
  readonly database: StorageDatabase
  readonly instanceId: string
}

export function machineClientCredentialsSupported(options: MachineClientCredentialsSupportedOptions): Result<boolean> {
  const users = machineRepositoryCreate(options.database.db).userList(options.instanceId)
  if (!users.success)
    return resultErrorCreate("machineClientCredentialsSupported", "The machine users could not be read.")
  return resultCreate(users.data.some((user) => user.status === "active"))
}

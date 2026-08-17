import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { instancePublicViewCreate } from "../domain/instancePublicViewCreate.js"
import type { InstanceSystemContext } from "../domain/instanceSystemContext.js"
import { instanceRepositoryCreate } from "../persistence/instanceRepositoryCreate.js"
import type { Instance } from "../public/instanceSchema.js"

type InstanceListOptions = {
  readonly context: InstanceSystemContext
  readonly database: StorageDatabase
}

export function instanceList(options: InstanceListOptions): Result<{ instances: Instance[] }> {
  const op = "instanceList"
  if (options.context?.kind !== "system") return resultErrorCreate(op, "Only the system context can list instances.")
  const repository = instanceRepositoryCreate(options.database.db)
  const rows = repository.instanceList()
  if (!rows.success) return rows
  const instances: Instance[] = []
  for (const row of rows.data) {
    const domains = repository.instanceDomainList(row.id)
    if (!domains.success) return domains
    instances.push(instancePublicViewCreate(row, domains.data))
  }
  return resultCreate({ instances })
}

import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { instancePublicViewCreate } from "../domain/instancePublicViewCreate.js"
import type { InstanceSystemContext } from "../domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../domain/instanceTenantContext.js"
import { instanceRepositoryCreate } from "../persistence/instanceRepositoryCreate.js"
import type { Instance } from "../public/instanceSchema.js"

type InstanceGetOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
}

export function instanceGet(options: InstanceGetOptions): Result<{ instance: Instance }> {
  const op = "instanceGet"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The instance is not available in this tenant context.")

  const repository = instanceRepositoryCreate(options.database.db)
  const instance = repository.instanceGet(options.instanceId)
  if (!instance.success) return instance
  if (instance.data === null) return resultErrorCreate(op, "The instance was not found.")
  const domains = repository.instanceDomainList(options.instanceId)
  if (!domains.success) return domains
  return resultCreate({ instance: instancePublicViewCreate(instance.data, domains.data) })
}

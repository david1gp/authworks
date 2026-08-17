import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { instanceDomainNormalize } from "../domain/instanceDomainNormalize.js"
import type { InstanceTenantContext } from "../domain/instanceTenantContext.js"
import { instanceTenantContextCreate } from "../domain/instanceTenantContextCreate.js"
import { instanceRepositoryCreate } from "../persistence/instanceRepositoryCreate.js"

type InstanceTenantContextResolveOptions = {
  readonly database: StorageDatabase
  readonly host?: string
}

export function instanceTenantContextResolve(
  options: InstanceTenantContextResolveOptions,
): Result<InstanceTenantContext> {
  const op = "instanceTenantContextResolve"
  if (options.host === undefined || options.host.length === 0)
    return resultErrorCreate(op, "The tenant host was not found.")
  const host = options.host.startsWith("[")
    ? options.host.slice(1, options.host.indexOf("]"))
    : options.host.split(":")[0]
  const domain = instanceDomainNormalize(host ?? "")
  if (!domain.success) return resultErrorCreate(op, "The tenant host was not found.")
  const instance = instanceRepositoryCreate(options.database.db).instanceFindByDomain(domain.data)
  if (!instance.success) return instance
  if (instance.data === null) return resultErrorCreate(op, "The tenant host was not found.")
  return resultCreate(instanceTenantContextCreate(instance.data.id, "anonymous"))
}

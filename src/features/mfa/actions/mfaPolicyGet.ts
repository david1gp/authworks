import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { instanceGet } from "../../instances/actions/instanceGet.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { mfaPolicyDefaults } from "../domain/mfaPolicyDefaults.js"
import { mfaPolicyViewCreate } from "../domain/mfaPolicyViewCreate.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaPolicy } from "../public/mfaPolicySchema.js"

type MfaPolicyGetOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
}

export function mfaPolicyGet(options: MfaPolicyGetOptions): Result<{ policy: MfaPolicy }> {
  const op = "mfaPolicyGet"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The MFA policy is not available in this tenant context.")
  const instance = instanceGet({ context: options.context, database: options.database, instanceId: options.instanceId })
  if (!instance.success) return instance
  if (instance.data.instance.status !== "active") return resultErrorCreate(op, "The instance is not active.")
  const row = mfaRepositoryCreate(options.database.db).mfaPolicyGet(options.instanceId)
  if (!row.success) return row
  return resultCreate({ policy: row.data === null ? mfaPolicyDefaults : mfaPolicyViewCreate(row.data) })
}

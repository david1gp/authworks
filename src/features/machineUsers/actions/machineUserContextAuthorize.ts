import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"

type MachineUserContextAuthorizeOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly permission?: "machine.credential.manage" | "machine.user.manage"
}

export function machineUserContextAuthorize(options: MachineUserContextAuthorizeOptions): Result<void> {
  const op = "machineUserContextAuthorize"
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The machine user is not available in this tenant context.")
  return authorizationEnforce({
    actor: options.context.actor,
    instanceId: options.instanceId,
    permission: options.permission ?? "machine.user.manage",
  })
}

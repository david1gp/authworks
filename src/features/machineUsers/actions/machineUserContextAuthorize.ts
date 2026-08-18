import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"

type MachineUserContextAuthorizeOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly permission?: "machine.credential.manage" | "machine.user.manage"
}

export function machineUserContextAuthorize(options: MachineUserContextAuthorizeOptions): Result<void> {
  const op = "machineUserContextAuthorize"
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The machine user is not available in this tenant context.")
  return authorizationEnforce({
    actor: options.context.actor,
    realmId: options.realmId,
    permission: options.permission ?? "machine.user.manage",
  })
}

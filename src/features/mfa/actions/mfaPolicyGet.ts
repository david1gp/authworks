import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { mfaPolicyDefaults } from "../domain/mfaPolicyDefaults.js"
import { mfaPolicyViewCreate } from "../domain/mfaPolicyViewCreate.js"
import { mfaRepositoryCreate } from "../persistence/mfaRepositoryCreate.js"
import type { MfaPolicy } from "../public/mfaPolicySchema.js"

type MfaPolicyGetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function mfaPolicyGet(options: MfaPolicyGetOptions): Result<{ policy: MfaPolicy }> {
  const op = "mfaPolicyGet"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "mfa.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The MFA policy is not available in this tenant context.", "mfa.tenant-mismatch")
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active") return resultErrorCreate(op, "The realm is not active.", "mfa.invalid")
  const row = mfaRepositoryCreate(options.database.db).mfaPolicyGet(options.realmId)
  if (!row.success) return row
  return resultCreate({ policy: row.data === null ? mfaPolicyDefaults : mfaPolicyViewCreate(row.data) })
}

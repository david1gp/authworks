import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { passwordPolicyDefaults } from "../domain/passwordPolicyDefaults.js"
import { passwordPolicyViewCreate } from "../domain/passwordPolicyViewCreate.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import type { PasswordPolicy } from "../public/passwordPolicySchema.js"

type PasswordPolicyGetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function passwordPolicyGet(options: PasswordPolicyGetOptions): Result<{ policy: PasswordPolicy }> {
  const op = "passwordPolicyGet"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "passwords.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(
      op,
      "The password policy is not available in this tenant context.",
      "passwords.tenant-mismatch",
    )
  const realm = realmGet({ context: options.context, database: options.database, realmId: options.realmId })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active")
    return resultErrorCreate(op, "The realm is not active.", "passwords.not-active")
  const row = passwordRepositoryCreate(options.database.db).passwordPolicyGet(options.realmId)
  if (!row.success) return row
  return resultCreate({ policy: row.data === null ? passwordPolicyDefaults : passwordPolicyViewCreate(row.data) })
}

import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userDirectoryEntryResolve } from "../../users/server/userDirectoryEntryResolve.js"
import { realmAdministratorPublicViewCreate } from "../domain/realmAdministratorPublicViewCreate.js"
import type { RealmSystemContext } from "../domain/realmSystemContext.js"
import type { RealmTenantContext } from "../domain/realmTenantContext.js"
import { realmAdministratorRepositoryCreate } from "../persistence/realmAdministratorRepositoryCreate.js"
import type { RealmAdministrator } from "../public/realmAdministratorSchema.js"

type RealmAdministratorListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function realmAdministratorList(options: RealmAdministratorListOptions): Result<{
  items: RealmAdministrator[]
}> {
  const op = "realmAdministratorList"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "realms.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The realm is not available in this tenant context.", "realms.tenant-mismatch")
  const repository = realmAdministratorRepositoryCreate(options.database.db)
  const rows = repository.realmAdministratorList(options.realmId)
  if (!rows.success) return rows
  const items: RealmAdministrator[] = []
  for (const row of rows.data) {
    const user = userDirectoryEntryResolve({ database: options.database, realmId: options.realmId, userId: row.userId })
    if (!user.success) return user
    if (user.data === undefined) continue
    items.push(realmAdministratorPublicViewCreate(row, user.data))
  }
  return resultCreate({ items })
}

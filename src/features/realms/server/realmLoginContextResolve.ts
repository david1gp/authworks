import { eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { realmTable } from "../persistence/realmTable.js"

type RealmLoginContextResolveOptions = {
  readonly executor: StorageExecutor
  readonly realmId: string
}

export function realmLoginContextResolve(options: RealmLoginContextResolveOptions): Result<{
  readonly id: string
  readonly status: string
  readonly version: number
}> {
  const op = "realmLoginContextResolve"
  if (options.realmId.length === 0)
    return resultErrorCodedCreate(op, "The realm login context is invalid.", "realms.not-found")
  try {
    const realm = options.executor
      .select({ id: realmTable.id, status: realmTable.status, version: realmTable.version })
      .from(realmTable)
      .where(eq(realmTable.id, options.realmId))
      .get()
    if (realm === undefined || realm.status !== "active")
      return resultErrorCodedCreate(op, "The realm login context is unavailable.", "realms.not-found")
    return resultCreate(realm)
  } catch (_error) {
    return resultErrorCodedCreate(op, "The realm login context could not be read.", "realms.read-failed")
  }
}

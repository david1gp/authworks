import { and, eq, isNull } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { passkeyCredentialTable } from "../persistence/passkeyCredentialTable.js"

type PasskeyUserFactorAvailableOptions = {
  readonly executor: StorageExecutor
  readonly realmId: string
  readonly userId: string
}

export function passkeyUserFactorAvailable(options: PasskeyUserFactorAvailableOptions): Result<boolean> {
  const credential = options.executor
    .select({ id: passkeyCredentialTable.id })
    .from(passkeyCredentialTable)
    .where(
      and(
        eq(passkeyCredentialTable.realmId, options.realmId),
        eq(passkeyCredentialTable.userId, options.userId),
        isNull(passkeyCredentialTable.revokedAt),
      ),
    )
    .get()
  return resultCreate(credential !== undefined)
}

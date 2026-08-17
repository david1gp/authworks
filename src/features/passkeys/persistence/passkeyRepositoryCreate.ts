import { and, desc, eq, isNull } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageEventTable } from "../../../platform/storage/storageEventTable.js"
import { passkeyCeremonyTable, type PasskeyCeremonyRow } from "./passkeyCeremonyTable.js"
import { passkeyCredentialTable, type PasskeyCredentialRow } from "./passkeyCredentialTable.js"

export function passkeyRepositoryCreate(database: StorageExecutor) {
  return {
    passkeyCeremonyCreate(input: typeof passkeyCeremonyTable.$inferInsert): Result<PasskeyCeremonyRow> {
      try {
        const row = database.insert(passkeyCeremonyTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("passkeyCeremonyCreate", "The passkey ceremony could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("passkeyCeremonyCreate", "The passkey ceremony could not be created.")
      }
    },

    passkeyCeremonyGetByTokenHash(instanceId: string, tokenHash: string): Result<PasskeyCeremonyRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(passkeyCeremonyTable)
            .where(and(eq(passkeyCeremonyTable.instanceId, instanceId), eq(passkeyCeremonyTable.tokenHash, tokenHash)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passkeyCeremonyGetByTokenHash", "The passkey ceremony could not be read.")
      }
    },

    passkeyCeremonyConsume(
      instanceId: string,
      id: string,
      tokenHash: string,
      expectedVersion: number,
      consumedAt: number,
    ): Result<PasskeyCeremonyRow | null> {
      try {
        return resultCreate(
          database
            .update(passkeyCeremonyTable)
            .set({ consumedAt, version: expectedVersion + 1 })
            .where(
              and(
                eq(passkeyCeremonyTable.instanceId, instanceId),
                eq(passkeyCeremonyTable.id, id),
                eq(passkeyCeremonyTable.tokenHash, tokenHash),
                eq(passkeyCeremonyTable.version, expectedVersion),
                isNull(passkeyCeremonyTable.consumedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passkeyCeremonyConsume", "The passkey ceremony could not be consumed.")
      }
    },

    passkeyCredentialCreate(input: typeof passkeyCredentialTable.$inferInsert): Result<PasskeyCredentialRow> {
      try {
        const row = database.insert(passkeyCredentialTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("passkeyCredentialCreate", "The passkey credential could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("passkeyCredentialCreate", "The passkey credential could not be created.")
      }
    },

    passkeyCredentialGetByCredentialId(
      instanceId: string,
      rpId: string,
      credentialId: string,
    ): Result<PasskeyCredentialRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(passkeyCredentialTable)
            .where(
              and(
                eq(passkeyCredentialTable.instanceId, instanceId),
                eq(passkeyCredentialTable.rpId, rpId),
                eq(passkeyCredentialTable.credentialId, credentialId),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passkeyCredentialGetByCredentialId", "The passkey credential could not be read.")
      }
    },

    passkeyCredentialList(instanceId: string, userId: string): Result<PasskeyCredentialRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(passkeyCredentialTable)
            .where(and(eq(passkeyCredentialTable.instanceId, instanceId), eq(passkeyCredentialTable.userId, userId)))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("passkeyCredentialList", "The passkey credentials could not be read.")
      }
    },

    passkeyCredentialGet(instanceId: string, userId: string, id: string): Result<PasskeyCredentialRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(passkeyCredentialTable)
            .where(
              and(
                eq(passkeyCredentialTable.instanceId, instanceId),
                eq(passkeyCredentialTable.userId, userId),
                eq(passkeyCredentialTable.id, id),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passkeyCredentialGet", "The passkey credential could not be read.")
      }
    },

    passkeyCredentialCounterUpdate(
      instanceId: string,
      id: string,
      expectedVersion: number,
      counter: number,
      backedUp: boolean,
      lastUsedAt: number,
    ): Result<PasskeyCredentialRow | null> {
      try {
        return resultCreate(
          database
            .update(passkeyCredentialTable)
            .set({ backedUp: backedUp ? 1 : 0, counter, lastUsedAt, version: expectedVersion + 1 })
            .where(
              and(
                eq(passkeyCredentialTable.instanceId, instanceId),
                eq(passkeyCredentialTable.id, id),
                eq(passkeyCredentialTable.version, expectedVersion),
                isNull(passkeyCredentialTable.revokedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passkeyCredentialCounterUpdate", "The passkey credential could not be updated.")
      }
    },

    passkeyCredentialRevoke(
      instanceId: string,
      userId: string,
      id: string,
      expectedVersion: number,
      revokedAt: number,
    ): Result<PasskeyCredentialRow | null> {
      try {
        return resultCreate(
          database
            .update(passkeyCredentialTable)
            .set({ revokedAt, version: expectedVersion + 1 })
            .where(
              and(
                eq(passkeyCredentialTable.instanceId, instanceId),
                eq(passkeyCredentialTable.userId, userId),
                eq(passkeyCredentialTable.id, id),
                eq(passkeyCredentialTable.version, expectedVersion),
                isNull(passkeyCredentialTable.revokedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("passkeyCredentialRevoke", "The passkey credential could not be revoked.")
      }
    },

    passkeyEventVersionGet(instanceId: string, aggregateType: string, aggregateId: string): Result<number> {
      try {
        const event = database
          .select({ aggregateVersion: storageEventTable.aggregateVersion })
          .from(storageEventTable)
          .where(
            and(
              eq(storageEventTable.instanceId, instanceId),
              eq(storageEventTable.aggregateType, aggregateType),
              eq(storageEventTable.aggregateId, aggregateId),
            ),
          )
          .orderBy(desc(storageEventTable.aggregateVersion))
          .get()
        return resultCreate(event?.aggregateVersion ?? 0)
      } catch (_error) {
        return resultErrorCreate("passkeyEventVersionGet", "The passkey event version could not be read.")
      }
    },
  }
}

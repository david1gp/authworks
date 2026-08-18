import { asc, and, eq, isNull, sql } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { machineCredentialTable, type MachineCredentialRow } from "./machineCredentialTable.js"
import { machineUserTable, type MachineUserRow } from "./machineUserTable.js"

type MachineUserInsert = typeof machineUserTable.$inferInsert
type MachineUserUpdate = Partial<MachineUserInsert>
type MachineCredentialInsert = typeof machineCredentialTable.$inferInsert
type MachineCredentialUpdate = Partial<MachineCredentialInsert>

export function machineRepositoryCreate(database: StorageExecutor) {
  return {
    credentialCreate(input: MachineCredentialInsert): Result<MachineCredentialRow> {
      try {
        const row = database.insert(machineCredentialTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("machineCredentialCreate", "The machine credential could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("machineCredentialCreate", "The machine credential could not be created.")
      }
    },

    credentialGet(realmId: string, credentialId: string): Result<MachineCredentialRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineCredentialTable)
            .where(and(eq(machineCredentialTable.realmId, realmId), eq(machineCredentialTable.id, credentialId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("machineCredentialGet", "The machine credential could not be read.")
      }
    },

    credentialGetByHash(realmId: string, secretHash: string): Result<MachineCredentialRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineCredentialTable)
            .where(and(eq(machineCredentialTable.realmId, realmId), eq(machineCredentialTable.secretHash, secretHash)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("machineCredentialGetByHash", "The machine credential could not be read.")
      }
    },

    credentialList(realmId: string, machineUserId: string): Result<MachineCredentialRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineCredentialTable)
            .where(
              and(eq(machineCredentialTable.realmId, realmId), eq(machineCredentialTable.machineUserId, machineUserId)),
            )
            .orderBy(asc(machineCredentialTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("machineCredentialList", "The machine credentials could not be read.")
      }
    },

    credentialListForRealm(realmId: string): Result<MachineCredentialRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineCredentialTable)
            .where(eq(machineCredentialTable.realmId, realmId))
            .orderBy(asc(machineCredentialTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("machineCredentialListForRealm", "The machine credentials could not be read.")
      }
    },

    credentialRevoke(realmId: string, credentialId: string, revokedAt: number): Result<MachineCredentialRow | null> {
      try {
        return resultCreate(
          database
            .update(machineCredentialTable)
            .set({ revokedAt, version: sql`${machineCredentialTable.version} + 1` })
            .where(
              and(
                eq(machineCredentialTable.realmId, realmId),
                eq(machineCredentialTable.id, credentialId),
                isNull(machineCredentialTable.revokedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("machineCredentialRevoke", "The machine credential could not be revoked.")
      }
    },

    credentialRevokeForUser(realmId: string, machineUserId: string, revokedAt: number): Result<MachineCredentialRow[]> {
      try {
        return resultCreate(
          database
            .update(machineCredentialTable)
            .set({ revokedAt, version: sql`${machineCredentialTable.version} + 1` })
            .where(
              and(
                eq(machineCredentialTable.realmId, realmId),
                eq(machineCredentialTable.machineUserId, machineUserId),
                isNull(machineCredentialTable.revokedAt),
              ),
            )
            .returning()
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("machineCredentialRevokeForUser", "The machine credentials could not be revoked.")
      }
    },

    credentialUpdate(
      realmId: string,
      credentialId: string,
      input: MachineCredentialUpdate,
    ): Result<MachineCredentialRow | null> {
      try {
        return resultCreate(
          database
            .update(machineCredentialTable)
            .set(input)
            .where(and(eq(machineCredentialTable.realmId, realmId), eq(machineCredentialTable.id, credentialId)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("machineCredentialUpdate", "The machine credential could not be updated.")
      }
    },

    userCreate(input: MachineUserInsert): Result<MachineUserRow> {
      try {
        const row = database.insert(machineUserTable).values(input).returning().get()
        if (row === undefined) return resultErrorCreate("machineUserCreate", "The machine user could not be created.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("machineUserCreate", "The machine user could not be created.")
      }
    },

    userGet(realmId: string, machineUserId: string): Result<MachineUserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineUserTable)
            .where(and(eq(machineUserTable.realmId, realmId), eq(machineUserTable.id, machineUserId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("machineUserGet", "The machine user could not be read.")
      }
    },

    userGetByName(realmId: string, userName: string): Result<MachineUserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineUserTable)
            .where(and(eq(machineUserTable.realmId, realmId), eq(machineUserTable.userName, userName)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("machineUserGetByName", "The machine user could not be read.")
      }
    },

    userList(realmId: string): Result<MachineUserRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineUserTable)
            .where(eq(machineUserTable.realmId, realmId))
            .orderBy(asc(machineUserTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("machineUserList", "The machine users could not be read.")
      }
    },

    userUpdate(realmId: string, machineUserId: string, input: MachineUserUpdate): Result<MachineUserRow | null> {
      try {
        return resultCreate(
          database
            .update(machineUserTable)
            .set(input)
            .where(and(eq(machineUserTable.realmId, realmId), eq(machineUserTable.id, machineUserId)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("machineUserUpdate", "The machine user could not be updated.")
      }
    },
  }
}

import { and, asc, eq, isNull, sql } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type MachineCredentialRow, machineCredentialTable } from "./machineCredentialTable.js"
import { type MachineUserRow, machineUserTable } from "./machineUserTable.js"

type MachineUserInsert = typeof machineUserTable.$inferInsert
type MachineUserUpdate = Partial<MachineUserInsert>
type MachineCredentialInsert = typeof machineCredentialTable.$inferInsert
type MachineCredentialUpdate = Partial<MachineCredentialInsert>

function machineUserScope(realmId: string, organizationId: string) {
  return and(eq(machineUserTable.realmId, realmId), eq(machineUserTable.organizationId, organizationId))
}

function machineCredentialScope(realmId: string, organizationId: string) {
  return and(eq(machineCredentialTable.realmId, realmId), eq(machineCredentialTable.organizationId, organizationId))
}

export function machineRepositoryCreate(database: StorageExecutor) {
  return {
    credentialCreate(input: MachineCredentialInsert): Result<MachineCredentialRow> {
      try {
        const row = database.insert(machineCredentialTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate(
            "machineCredentialCreate",
            "The machine credential could not be created.",
            "machine-users.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "machineCredentialCreate",
          "The machine credential could not be created.",
          "machine-users.write-failed",
        )
      }
    },

    credentialGet(realmId: string, organizationId: string, credentialId: string): Result<MachineCredentialRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineCredentialTable)
            .where(and(machineCredentialScope(realmId, organizationId), eq(machineCredentialTable.id, credentialId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "machineCredentialGet",
          "The machine credential could not be read.",
          "machine-users.read-failed",
        )
      }
    },

    credentialGetByHash(
      realmId: string,
      organizationId: string,
      secretHash: string,
    ): Result<MachineCredentialRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineCredentialTable)
            .where(
              and(machineCredentialScope(realmId, organizationId), eq(machineCredentialTable.secretHash, secretHash)),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "machineCredentialGetByHash",
          "The machine credential could not be read.",
          "machine-users.read-failed",
        )
      }
    },

    credentialList(realmId: string, organizationId: string, machineUserId: string): Result<MachineCredentialRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineCredentialTable)
            .where(
              and(
                machineCredentialScope(realmId, organizationId),
                eq(machineCredentialTable.machineUserId, machineUserId),
              ),
            )
            .orderBy(asc(machineCredentialTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate(
          "machineCredentialList",
          "The machine credentials could not be read.",
          "machine-users.read-failed",
        )
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
        return resultErrorCreate(
          "credentialListForRealm",
          "The machine credentials could not be read.",
          "machine-users.read-failed",
        )
      }
    },

    credentialListForOrganization(realmId: string, organizationId: string): Result<MachineCredentialRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineCredentialTable)
            .where(machineCredentialScope(realmId, organizationId))
            .orderBy(asc(machineCredentialTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate(
          "machineCredentialListForOrganization",
          "The machine credentials could not be read.",
          "machine-users.read-failed",
        )
      }
    },

    credentialRevoke(
      realmId: string,
      organizationId: string,
      credentialId: string,
      revokedAt: number,
    ): Result<MachineCredentialRow | null> {
      try {
        return resultCreate(
          database
            .update(machineCredentialTable)
            .set({ revokedAt, version: sql`${machineCredentialTable.version} + 1` })
            .where(
              and(
                machineCredentialScope(realmId, organizationId),
                eq(machineCredentialTable.id, credentialId),
                isNull(machineCredentialTable.revokedAt),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "machineCredentialRevoke",
          "The machine credential could not be revoked.",
          "machine-users.write-failed",
        )
      }
    },

    credentialRevokeForUser(
      realmId: string,
      organizationId: string,
      machineUserId: string,
      revokedAt: number,
    ): Result<MachineCredentialRow[]> {
      try {
        return resultCreate(
          database
            .update(machineCredentialTable)
            .set({ revokedAt, version: sql`${machineCredentialTable.version} + 1` })
            .where(
              and(
                machineCredentialScope(realmId, organizationId),
                eq(machineCredentialTable.machineUserId, machineUserId),
                isNull(machineCredentialTable.revokedAt),
              ),
            )
            .returning()
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate(
          "machineCredentialRevokeForUser",
          "The machine credentials could not be revoked.",
          "machine-users.write-failed",
        )
      }
    },

    credentialUpdate(
      realmId: string,
      organizationId: string,
      credentialId: string,
      input: MachineCredentialUpdate,
    ): Result<MachineCredentialRow | null> {
      try {
        return resultCreate(
          database
            .update(machineCredentialTable)
            .set(input)
            .where(and(machineCredentialScope(realmId, organizationId), eq(machineCredentialTable.id, credentialId)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "machineCredentialUpdate",
          "The machine credential could not be updated.",
          "machine-users.write-failed",
        )
      }
    },

    userCreate(input: MachineUserInsert): Result<MachineUserRow> {
      try {
        const row = database.insert(machineUserTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate(
            "machineUserCreate",
            "The machine user could not be created.",
            "machine-users.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate(
          "machineUserCreate",
          "The machine user could not be created.",
          "machine-users.write-failed",
        )
      }
    },

    userGet(realmId: string, organizationId: string, machineUserId: string): Result<MachineUserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineUserTable)
            .where(and(machineUserScope(realmId, organizationId), eq(machineUserTable.id, machineUserId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("machineUserGet", "The machine user could not be read.", "machine-users.read-failed")
      }
    },

    userGetByName(realmId: string, organizationId: string, userName: string): Result<MachineUserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineUserTable)
            .where(and(machineUserScope(realmId, organizationId), eq(machineUserTable.userName, userName)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "machineUserGetByName",
          "The machine user could not be read.",
          "machine-users.read-failed",
        )
      }
    },

    userGetByIdForRealm(realmId: string, machineUserId: string): Result<MachineUserRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineUserTable)
            .where(and(eq(machineUserTable.realmId, realmId), eq(machineUserTable.id, machineUserId)))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "machineUserGetByIdForRealm",
          "The machine user could not be read.",
          "machine-users.read-failed",
        )
      }
    },

    userListByNameForRealm(realmId: string, userName: string): Result<MachineUserRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineUserTable)
            .where(and(eq(machineUserTable.realmId, realmId), eq(machineUserTable.userName, userName)))
            .orderBy(asc(machineUserTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate(
          "machineUserListByNameForRealm",
          "The machine users could not be read.",
          "machine-users.read-failed",
        )
      }
    },

    userListForRealm(realmId: string): Result<MachineUserRow[]> {
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
        return resultErrorCreate(
          "machineUserListForRealm",
          "The machine users could not be read.",
          "machine-users.read-failed",
        )
      }
    },

    userList(realmId: string, organizationId: string): Result<MachineUserRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(machineUserTable)
            .where(machineUserScope(realmId, organizationId))
            .orderBy(asc(machineUserTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("machineUserList", "The machine users could not be read.", "machine-users.read-failed")
      }
    },

    userUpdate(
      realmId: string,
      organizationId: string,
      machineUserId: string,
      input: MachineUserUpdate,
    ): Result<MachineUserRow | null> {
      try {
        return resultCreate(
          database
            .update(machineUserTable)
            .set(input)
            .where(and(machineUserScope(realmId, organizationId), eq(machineUserTable.id, machineUserId)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "machineUserUpdate",
          "The machine user could not be updated.",
          "machine-users.write-failed",
        )
      }
    },

    userDelete(realmId: string, organizationId: string, machineUserId: string): Result<MachineUserRow | null> {
      try {
        return resultCreate(
          database
            .delete(machineUserTable)
            .where(and(machineUserScope(realmId, organizationId), eq(machineUserTable.id, machineUserId)))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "machineUserDelete",
          "The machine user could not be deleted.",
          "machine-users.write-failed",
        )
      }
    },
  }
}

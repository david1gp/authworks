import { eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { realmLoginPolicyTable, type RealmLoginPolicyRow } from "./realmLoginPolicyTable.js"
import { organizationLoginPolicyTable, type OrganizationLoginPolicyRow } from "./organizationLoginPolicyTable.js"

export function organizationLoginPolicyRepositoryCreate(database: StorageExecutor) {
  return {
    realmLoginPolicyCreate(input: typeof realmLoginPolicyTable.$inferInsert): Result<RealmLoginPolicyRow> {
      try {
        const row = database.insert(realmLoginPolicyTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("realmLoginPolicyCreate", "The login policy could not be saved.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("realmLoginPolicyCreate", "The login policy could not be saved.")
      }
    },

    realmLoginPolicyGet(realmId: string): Result<RealmLoginPolicyRow | null> {
      try {
        return resultCreate(
          database.select().from(realmLoginPolicyTable).where(eq(realmLoginPolicyTable.realmId, realmId)).get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("realmLoginPolicyGet", "The login policy could not be read.")
      }
    },

    realmLoginPolicyUpdate(
      realmId: string,
      input: Partial<typeof realmLoginPolicyTable.$inferInsert>,
    ): Result<RealmLoginPolicyRow | null> {
      try {
        return resultCreate(
          database
            .update(realmLoginPolicyTable)
            .set(input)
            .where(eq(realmLoginPolicyTable.realmId, realmId))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("realmLoginPolicyUpdate", "The login policy could not be saved.")
      }
    },

    organizationLoginPolicyCreate(
      input: typeof organizationLoginPolicyTable.$inferInsert,
    ): Result<OrganizationLoginPolicyRow> {
      try {
        const row = database.insert(organizationLoginPolicyTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("organizationLoginPolicyCreate", "The login policy could not be saved.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("organizationLoginPolicyCreate", "The login policy could not be saved.")
      }
    },

    organizationLoginPolicyGet(organizationId: string): Result<OrganizationLoginPolicyRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationLoginPolicyTable)
            .where(eq(organizationLoginPolicyTable.organizationId, organizationId))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationLoginPolicyGet", "The login policy could not be read.")
      }
    },

    organizationLoginPolicyUpdate(
      organizationId: string,
      input: Partial<typeof organizationLoginPolicyTable.$inferInsert>,
    ): Result<OrganizationLoginPolicyRow | null> {
      try {
        return resultCreate(
          database
            .update(organizationLoginPolicyTable)
            .set(input)
            .where(eq(organizationLoginPolicyTable.organizationId, organizationId))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationLoginPolicyUpdate", "The login policy could not be saved.")
      }
    },
  }
}

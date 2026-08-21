import { eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type OrganizationLoginPolicyRow, organizationLoginPolicyTable } from "./organizationLoginPolicyTable.js"
import { type RealmLoginPolicyRow, realmLoginPolicyTable } from "./realmLoginPolicyTable.js"

export function organizationLoginPolicyRepositoryCreate(database: StorageExecutor) {
  return {
    realmLoginPolicyCreate(input: typeof realmLoginPolicyTable.$inferInsert): Result<RealmLoginPolicyRow> {
      try {
        const row = database.insert(realmLoginPolicyTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "realmLoginPolicyCreate",
            "The login policy could not be saved.",
            "organizations.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "realmLoginPolicyCreate",
          "The login policy could not be saved.",
          "organizations.write-failed",
        )
      }
    },

    realmLoginPolicyGet(realmId: string): Result<RealmLoginPolicyRow | null> {
      try {
        return resultCreate(
          database.select().from(realmLoginPolicyTable).where(eq(realmLoginPolicyTable.realmId, realmId)).get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "realmLoginPolicyGet",
          "The login policy could not be read.",
          "organizations.read-failed",
        )
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
        return resultErrorCodedCreate(
          "realmLoginPolicyUpdate",
          "The login policy could not be saved.",
          "organizations.write-failed",
        )
      }
    },

    organizationLoginPolicyCreate(
      input: typeof organizationLoginPolicyTable.$inferInsert,
    ): Result<OrganizationLoginPolicyRow> {
      try {
        const row = database.insert(organizationLoginPolicyTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "organizationLoginPolicyCreate",
            "The login policy could not be saved.",
            "organizations.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationLoginPolicyCreate",
          "The login policy could not be saved.",
          "organizations.write-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationLoginPolicyGet",
          "The login policy could not be read.",
          "organizations.read-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationLoginPolicyUpdate",
          "The login policy could not be saved.",
          "organizations.write-failed",
        )
      }
    },
  }
}

import { eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { instanceLoginPolicyTable, type InstanceLoginPolicyRow } from "./instanceLoginPolicyTable.js"
import { organizationLoginPolicyTable, type OrganizationLoginPolicyRow } from "./organizationLoginPolicyTable.js"

export function organizationLoginPolicyRepositoryCreate(database: StorageExecutor) {
  return {
    instanceLoginPolicyCreate(input: typeof instanceLoginPolicyTable.$inferInsert): Result<InstanceLoginPolicyRow> {
      try {
        const row = database.insert(instanceLoginPolicyTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("instanceLoginPolicyCreate", "The login policy could not be saved.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("instanceLoginPolicyCreate", "The login policy could not be saved.")
      }
    },

    instanceLoginPolicyGet(instanceId: string): Result<InstanceLoginPolicyRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(instanceLoginPolicyTable)
            .where(eq(instanceLoginPolicyTable.instanceId, instanceId))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("instanceLoginPolicyGet", "The login policy could not be read.")
      }
    },

    instanceLoginPolicyUpdate(
      instanceId: string,
      input: Partial<typeof instanceLoginPolicyTable.$inferInsert>,
    ): Result<InstanceLoginPolicyRow | null> {
      try {
        return resultCreate(
          database
            .update(instanceLoginPolicyTable)
            .set(input)
            .where(eq(instanceLoginPolicyTable.instanceId, instanceId))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("instanceLoginPolicyUpdate", "The login policy could not be saved.")
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

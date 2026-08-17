import { eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationBrandingTable, type OrganizationBrandingRow } from "./organizationBrandingTable.js"

export function organizationBrandingRepositoryCreate(database: StorageExecutor) {
  return {
    organizationBrandingCreate(input: typeof organizationBrandingTable.$inferInsert): Result<OrganizationBrandingRow> {
      try {
        const row = database.insert(organizationBrandingTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("organizationBrandingCreate", "The branding could not be saved.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("organizationBrandingCreate", "The branding could not be saved.")
      }
    },

    organizationBrandingGet(organizationId: string): Result<OrganizationBrandingRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationBrandingTable)
            .where(eq(organizationBrandingTable.organizationId, organizationId))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationBrandingGet", "The branding could not be read.")
      }
    },

    organizationBrandingUpdate(
      organizationId: string,
      input: Partial<typeof organizationBrandingTable.$inferInsert>,
    ): Result<OrganizationBrandingRow | null> {
      try {
        return resultCreate(
          database
            .update(organizationBrandingTable)
            .set(input)
            .where(eq(organizationBrandingTable.organizationId, organizationId))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationBrandingUpdate", "The branding could not be saved.")
      }
    },
  }
}

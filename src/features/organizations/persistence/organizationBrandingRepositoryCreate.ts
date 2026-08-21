import { eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type OrganizationBrandingRow, organizationBrandingTable } from "./organizationBrandingTable.js"

export function organizationBrandingRepositoryCreate(database: StorageExecutor) {
  return {
    organizationBrandingCreate(input: typeof organizationBrandingTable.$inferInsert): Result<OrganizationBrandingRow> {
      try {
        const row = database.insert(organizationBrandingTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "organizationBrandingCreate",
            "The branding could not be saved.",
            "organizations.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationBrandingCreate",
          "The branding could not be saved.",
          "organizations.write-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationBrandingGet",
          "The branding could not be read.",
          "organizations.read-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationBrandingUpdate",
          "The branding could not be saved.",
          "organizations.write-failed",
        )
      }
    },
  }
}

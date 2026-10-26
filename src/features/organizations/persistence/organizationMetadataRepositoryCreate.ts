import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type OrganizationMetadataRow, organizationMetadataTable } from "./organizationMetadataTable.js"

export function organizationMetadataRepositoryCreate(database: StorageExecutor) {
  return {
    organizationMetadataCount(realmId: string, organizationId: string): Result<number> {
      try {
        const rows = database
          .select({ key: organizationMetadataTable.key })
          .from(organizationMetadataTable)
          .where(
            and(
              eq(organizationMetadataTable.realmId, realmId),
              eq(organizationMetadataTable.organizationId, organizationId),
            ),
          )
          .all()
        return resultCreate(rows.length)
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationMetadataCount",
          "The organization metadata could not be read.",
          "organizations.read-failed",
        )
      }
    },

    organizationMetadataDelete(
      realmId: string,
      organizationId: string,
      key: string,
    ): Result<OrganizationMetadataRow | null> {
      try {
        return resultCreate(
          database
            .delete(organizationMetadataTable)
            .where(
              and(
                eq(organizationMetadataTable.realmId, realmId),
                eq(organizationMetadataTable.organizationId, organizationId),
                eq(organizationMetadataTable.key, key),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationMetadataDelete",
          "The organization metadata could not be removed.",
          "organizations.write-failed",
        )
      }
    },

    organizationMetadataGet(
      realmId: string,
      organizationId: string,
      key: string,
    ): Result<OrganizationMetadataRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationMetadataTable)
            .where(
              and(
                eq(organizationMetadataTable.realmId, realmId),
                eq(organizationMetadataTable.organizationId, organizationId),
                eq(organizationMetadataTable.key, key),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationMetadataGet",
          "The organization metadata could not be read.",
          "organizations.read-failed",
        )
      }
    },

    organizationMetadataList(realmId: string, organizationId: string): Result<OrganizationMetadataRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationMetadataTable)
            .where(
              and(
                eq(organizationMetadataTable.realmId, realmId),
                eq(organizationMetadataTable.organizationId, organizationId),
              ),
            )
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationMetadataList",
          "The organization metadata could not be read.",
          "organizations.read-failed",
        )
      }
    },

    organizationMetadataUpsert(input: typeof organizationMetadataTable.$inferInsert): Result<OrganizationMetadataRow> {
      try {
        const row = database
          .insert(organizationMetadataTable)
          .values(input)
          .onConflictDoUpdate({
            set: { updatedAt: input.updatedAt, value: input.value, version: input.version },
            target: [
              organizationMetadataTable.realmId,
              organizationMetadataTable.organizationId,
              organizationMetadataTable.key,
            ],
          })
          .returning()
          .get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "organizationMetadataUpsert",
            "The organization metadata could not be saved.",
            "organizations.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationMetadataUpsert",
          "The organization metadata could not be saved.",
          "organizations.write-failed",
        )
      }
    },
  }
}

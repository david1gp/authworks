import { and, asc, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationDomainTable, type OrganizationDomainRow } from "./organizationDomainTable.js"

export function organizationDomainRepositoryCreate(database: StorageExecutor) {
  return {
    organizationDomainCreate(input: typeof organizationDomainTable.$inferInsert): Result<OrganizationDomainRow> {
      try {
        const row = database.insert(organizationDomainTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCreate("organizationDomainCreate", "The organization domain could not be claimed.")
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCreate("organizationDomainCreate", "The organization domain could not be claimed.")
      }
    },

    organizationDomainDelete(domain: string, organizationId: string): Result<OrganizationDomainRow | null> {
      try {
        return resultCreate(
          database
            .delete(organizationDomainTable)
            .where(
              and(
                eq(organizationDomainTable.domain, domain),
                eq(organizationDomainTable.organizationId, organizationId),
              ),
            )
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationDomainDelete", "The organization domain could not be removed.")
      }
    },

    organizationDomainGet(domain: string): Result<OrganizationDomainRow | null> {
      try {
        return resultCreate(
          database.select().from(organizationDomainTable).where(eq(organizationDomainTable.domain, domain)).get() ??
            null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationDomainGet", "The organization domain could not be read.")
      }
    },

    organizationDomainList(organizationId: string): Result<OrganizationDomainRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationDomainTable)
            .where(eq(organizationDomainTable.organizationId, organizationId))
            .orderBy(asc(organizationDomainTable.createdAt))
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("organizationDomainList", "The organization domains could not be read.")
      }
    },

    organizationDomainUpdate(
      domain: string,
      input: Partial<typeof organizationDomainTable.$inferInsert>,
    ): Result<OrganizationDomainRow | null> {
      try {
        return resultCreate(
          database
            .update(organizationDomainTable)
            .set(input)
            .where(eq(organizationDomainTable.domain, domain))
            .returning()
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("organizationDomainUpdate", "The organization domain could not be updated.")
      }
    },
  }
}

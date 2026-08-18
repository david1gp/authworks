import { and, asc, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationDomainTable, type OrganizationDomainRow } from "./organizationDomainTable.js"

export function organizationDomainRepositoryCreate(database: StorageExecutor) {
  return {
    organizationDomainCreate(input: typeof organizationDomainTable.$inferInsert): Result<OrganizationDomainRow> {
      try {
        const row = database.insert(organizationDomainTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "organizationDomainCreate",
            "The organization domain could not be claimed.",
            "organizations.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationDomainCreate",
          "The organization domain could not be claimed.",
          "organizations.write-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationDomainDelete",
          "The organization domain could not be removed.",
          "organizations.write-failed",
        )
      }
    },

    organizationDomainGet(domain: string): Result<OrganizationDomainRow | null> {
      try {
        return resultCreate(
          database.select().from(organizationDomainTable).where(eq(organizationDomainTable.domain, domain)).get() ??
            null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationDomainGet",
          "The organization domain could not be read.",
          "organizations.read-failed",
        )
      }
    },

    organizationDomainList(organizationId: string): Result<OrganizationDomainRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(organizationDomainTable)
            .where(eq(organizationDomainTable.organizationId, organizationId))
            .orderBy(asc(organizationDomainTable.createdAt), asc(organizationDomainTable.domain))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "organizationDomainList",
          "The organization domains could not be read.",
          "organizations.read-failed",
        )
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
        return resultErrorCodedCreate(
          "organizationDomainUpdate",
          "The organization domain could not be updated.",
          "organizations.write-failed",
        )
      }
    },
  }
}

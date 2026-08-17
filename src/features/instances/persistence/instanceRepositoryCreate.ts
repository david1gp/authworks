import { eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type InstanceBootstrapAdminRow, instanceBootstrapAdminTable } from "./instanceBootstrapAdminTable.js"
import { instanceDomainTable } from "./instanceDomainTable.js"
import { type InstanceRow, instanceTable } from "./instanceTable.js"

type InstanceInsert = typeof instanceTable.$inferInsert
type InstanceUpdate = Partial<InstanceInsert>

export function instanceRepositoryCreate(database: StorageExecutor) {
  return {
    instanceBootstrapAdminGet(instanceId: string): Result<InstanceBootstrapAdminRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(instanceBootstrapAdminTable)
            .where(eq(instanceBootstrapAdminTable.instanceId, instanceId))
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("instanceBootstrapAdminGet", "The bootstrap administrator could not be read.")
      }
    },

    instanceCreate(input: InstanceInsert, domains: string[]): Result<InstanceRow> {
      try {
        const instance = database.insert(instanceTable).values(input).returning().get()
        if (instance === undefined) return resultErrorCreate("instanceCreate", "The instance could not be created.")
        database
          .insert(instanceDomainTable)
          .values(
            domains.map((domain, index) => ({
              domain,
              instanceId: instance.id,
              isPrimary: index === 0 ? "true" : "false",
            })),
          )
          .run()
        return resultCreate(instance)
      } catch (_error) {
        return resultErrorCreate("instanceCreate", "The instance could not be created.")
      }
    },

    instanceDomainList(instanceId: string): Result<string[]> {
      try {
        const domains = database
          .select({ domain: instanceDomainTable.domain })
          .from(instanceDomainTable)
          .where(eq(instanceDomainTable.instanceId, instanceId))
          .all()
          .map((row) => row.domain)
        return resultCreate(domains)
      } catch (_error) {
        return resultErrorCreate("instanceDomainList", "The instance domains could not be read.")
      }
    },

    instanceGet(instanceId: string): Result<InstanceRow | null> {
      try {
        return resultCreate(database.select().from(instanceTable).where(eq(instanceTable.id, instanceId)).get() ?? null)
      } catch (_error) {
        return resultErrorCreate("instanceGet", "The instance could not be read.")
      }
    },

    instanceList(): Result<InstanceRow[]> {
      try {
        return resultCreate(database.select().from(instanceTable).orderBy(instanceTable.createdAt).all())
      } catch (_error) {
        return resultErrorCreate("instanceList", "The instances could not be read.")
      }
    },

    instanceUpdate(instanceId: string, input: InstanceUpdate): Result<InstanceRow | null> {
      try {
        return resultCreate(
          database.update(instanceTable).set(input).where(eq(instanceTable.id, instanceId)).returning().get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("instanceUpdate", "The instance could not be updated.")
      }
    },

    instanceBootstrapAdminCreate(
      input: typeof instanceBootstrapAdminTable.$inferInsert,
    ): Result<InstanceBootstrapAdminRow> {
      try {
        const admin = database.insert(instanceBootstrapAdminTable).values(input).returning().get()
        if (admin === undefined)
          return resultErrorCreate("instanceBootstrapAdminCreate", "The bootstrap administrator could not be created.")
        return resultCreate(admin)
      } catch (_error) {
        return resultErrorCreate("instanceBootstrapAdminCreate", "The bootstrap administrator could not be created.")
      }
    },

    instanceDomainReplace(instanceId: string, domains: string[]): Result<void> {
      try {
        database.delete(instanceDomainTable).where(eq(instanceDomainTable.instanceId, instanceId)).run()
        database
          .insert(instanceDomainTable)
          .values(domains.map((domain, index) => ({ domain, instanceId, isPrimary: index === 0 ? "true" : "false" })))
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCreate("instanceDomainReplace", "The instance domains could not be updated.")
      }
    },

    instanceFindByDomain(domain: string): Result<InstanceRow | null> {
      try {
        const domainRow = database
          .select()
          .from(instanceDomainTable)
          .where(eq(instanceDomainTable.domain, domain))
          .get()
        if (domainRow === undefined) return resultCreate(null)
        return this.instanceGet(domainRow.instanceId)
      } catch (_error) {
        return resultErrorCreate("instanceFindByDomain", "The instance could not be resolved.")
      }
    },
  }
}

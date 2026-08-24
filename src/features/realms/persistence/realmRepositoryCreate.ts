import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationDomainTable } from "../../organizations/persistence/organizationDomainTable.js"
import { type RealmBootstrapAdminRow, realmBootstrapAdminTable } from "./realmBootstrapAdminTable.js"
import { realmDomainTable } from "./realmDomainTable.js"
import { type RealmRow, realmTable } from "./realmTable.js"

type RealmInsert = typeof realmTable.$inferInsert
type RealmUpdate = Partial<RealmInsert>

export function realmRepositoryCreate(database: StorageExecutor) {
  return {
    realmBootstrapAdminGet(realmId: string): Result<RealmBootstrapAdminRow | null> {
      try {
        return resultCreate(
          database.select().from(realmBootstrapAdminTable).where(eq(realmBootstrapAdminTable.realmId, realmId)).get() ??
            null,
        )
      } catch (_error) {
        return resultErrorCreate(
          "realmBootstrapAdminGet",
          "The bootstrap administrator could not be read.",
          "realms.read-failed",
        )
      }
    },

    realmCreate(input: RealmInsert, domains: string[]): Result<RealmRow> {
      try {
        const realm = database.insert(realmTable).values(input).returning().get()
        if (realm === undefined)
          return resultErrorCreate("realmCreate", "The realm could not be created.", "realms.write-failed")
        database
          .insert(realmDomainTable)
          .values(
            domains.map((domain, index) => ({
              domain,
              realmId: realm.id,
              isPrimary: index === 0 ? "true" : "false",
            })),
          )
          .run()
        return resultCreate(realm)
      } catch (_error) {
        return resultErrorCreate("realmCreate", "The realm could not be created.", "realms.write-failed")
      }
    },

    realmDomainList(realmId: string): Result<string[]> {
      try {
        const domains = database
          .select({ domain: realmDomainTable.domain })
          .from(realmDomainTable)
          .where(eq(realmDomainTable.realmId, realmId))
          .all()
          .map((row) => row.domain)
        return resultCreate(domains)
      } catch (_error) {
        return resultErrorCreate("realmDomainList", "The realm domains could not be read.", "realms.read-failed")
      }
    },

    realmGet(realmId: string): Result<RealmRow | null> {
      try {
        return resultCreate(database.select().from(realmTable).where(eq(realmTable.id, realmId)).get() ?? null)
      } catch (_error) {
        return resultErrorCreate("realmGet", "The realm could not be read.", "realms.read-failed")
      }
    },

    realmList(): Result<RealmRow[]> {
      try {
        return resultCreate(database.select().from(realmTable).orderBy(realmTable.createdAt).all())
      } catch (_error) {
        return resultErrorCreate("realmList", "The realms could not be read.", "realms.read-failed")
      }
    },

    realmListWithDomains(): Result<Array<{ domains: string[]; realm: RealmRow }>> {
      try {
        const realms = database.select().from(realmTable).orderBy(realmTable.createdAt).all()
        const domainsByRealm = new Map<string, string[]>()
        for (const row of database.select().from(realmDomainTable).all()) {
          const domains = domainsByRealm.get(row.realmId) ?? []
          domains.push(row.domain)
          domainsByRealm.set(row.realmId, domains)
        }
        return resultCreate(realms.map((realm) => ({ domains: domainsByRealm.get(realm.id) ?? [], realm })))
      } catch (_error) {
        return resultErrorCreate("realmListWithDomains", "The realms could not be read.", "realms.read-failed")
      }
    },

    realmUpdate(realmId: string, input: RealmUpdate): Result<RealmRow | null> {
      try {
        return resultCreate(
          database.update(realmTable).set(input).where(eq(realmTable.id, realmId)).returning().get() ?? null,
        )
      } catch (_error) {
        return resultErrorCreate("realmUpdate", "The realm could not be updated.", "realms.write-failed")
      }
    },

    realmBootstrapAdminCreate(input: typeof realmBootstrapAdminTable.$inferInsert): Result<RealmBootstrapAdminRow> {
      try {
        const admin = database.insert(realmBootstrapAdminTable).values(input).returning().get()
        if (admin === undefined)
          return resultErrorCreate(
            "realmBootstrapAdminCreate",
            "The bootstrap administrator could not be created.",
            "realms.write-failed",
          )
        return resultCreate(admin)
      } catch (_error) {
        return resultErrorCreate(
          "realmBootstrapAdminCreate",
          "The bootstrap administrator could not be created.",
          "realms.write-failed",
        )
      }
    },

    realmDomainReplace(realmId: string, domains: string[]): Result<void> {
      try {
        database.delete(realmDomainTable).where(eq(realmDomainTable.realmId, realmId)).run()
        database
          .insert(realmDomainTable)
          .values(domains.map((domain, index) => ({ domain, realmId, isPrimary: index === 0 ? "true" : "false" })))
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCreate("realmDomainReplace", "The realm domains could not be updated.", "realms.write-failed")
      }
    },

    realmFindByDomain(domain: string): Result<RealmRow | null> {
      try {
        const domainRow = database.select().from(realmDomainTable).where(eq(realmDomainTable.domain, domain)).get()
        if (domainRow !== undefined) return this.realmGet(domainRow.realmId)
        const organizationDomainRow = database
          .select({ realmId: organizationDomainTable.realmId })
          .from(organizationDomainTable)
          .where(and(eq(organizationDomainTable.domain, domain), eq(organizationDomainTable.verified, true)))
          .get()
        if (organizationDomainRow === undefined) return resultCreate(null)
        return this.realmGet(organizationDomainRow.realmId)
      } catch (_error) {
        return resultErrorCreate("realmFindByDomain", "The realm could not be resolved.", "realms.read-failed")
      }
    },
  }
}

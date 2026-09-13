import { and, asc, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import {
  type ZitadelMigrationSourceRecord,
  zitadelMigrationSourceRecordTable,
} from "./zitadelMigrationSourceRecordTable.js"

export function zitadelMigrationSourceRecordRepositoryCreate(database: StorageExecutor) {
  return {
    sourceRecordUpsert(
      input: typeof zitadelMigrationSourceRecordTable.$inferInsert,
    ): Result<ZitadelMigrationSourceRecord> {
      try {
        const row = database
          .insert(zitadelMigrationSourceRecordTable)
          .values({ ...input, sourceInstance: normalizeSourceInstance(input.sourceInstance) })
          .onConflictDoUpdate({
            target: [
              zitadelMigrationSourceRecordTable.realmId,
              zitadelMigrationSourceRecordTable.sourceInstance,
              zitadelMigrationSourceRecordTable.entityType,
              zitadelMigrationSourceRecordTable.sourceId,
            ],
            set: {
              destinationId: input.destinationId,
              sourceVersion: input.sourceVersion,
              sourceUpdatedAt: input.sourceUpdatedAt,
            },
          })
          .returning()
          .get()
        return row === undefined
          ? resultErrorCodedCreate(
              "sourceRecordUpsert",
              "Source record was not stored.",
              "zitadel-migration.write-failed",
            )
          : resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "sourceRecordUpsert",
          "Source record was not stored.",
          "zitadel-migration.write-failed",
        )
      }
    },
    sourceRecordGet(
      realmId: string,
      sourceInstance: string,
      entityType: string,
      sourceId: string,
    ): Result<ZitadelMigrationSourceRecord | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(zitadelMigrationSourceRecordTable)
            .where(
              and(
                eq(zitadelMigrationSourceRecordTable.realmId, realmId),
                eq(zitadelMigrationSourceRecordTable.sourceInstance, normalizeSourceInstance(sourceInstance)),
                eq(zitadelMigrationSourceRecordTable.entityType, entityType),
                eq(zitadelMigrationSourceRecordTable.sourceId, sourceId),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "sourceRecordGet",
          "Source record could not be read.",
          "zitadel-migration.read-failed",
        )
      }
    },
    sourceRecordList(realmId: string, sourceInstance: string): Result<ZitadelMigrationSourceRecord[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(zitadelMigrationSourceRecordTable)
            .where(
              and(
                eq(zitadelMigrationSourceRecordTable.realmId, realmId),
                eq(zitadelMigrationSourceRecordTable.sourceInstance, normalizeSourceInstance(sourceInstance)),
              ),
            )
            .orderBy(asc(zitadelMigrationSourceRecordTable.entityType), asc(zitadelMigrationSourceRecordTable.sourceId))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "sourceRecordList",
          "Source records could not be read.",
          "zitadel-migration.read-failed",
        )
      }
    },
    sourceRecordFindByDestination(
      realmId: string,
      entityType: string,
      destinationId: string,
    ): Result<ZitadelMigrationSourceRecord[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(zitadelMigrationSourceRecordTable)
            .where(
              and(
                eq(zitadelMigrationSourceRecordTable.realmId, realmId),
                eq(zitadelMigrationSourceRecordTable.entityType, entityType),
                eq(zitadelMigrationSourceRecordTable.destinationId, destinationId),
              ),
            )
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "sourceRecordFindByDestination",
          "Source records could not be read.",
          "zitadel-migration.read-failed",
        )
      }
    },
    sourceRecordDelete(realmId: string, sourceInstance: string, entityType: string, sourceId: string): Result<void> {
      try {
        database
          .delete(zitadelMigrationSourceRecordTable)
          .where(
            and(
              eq(zitadelMigrationSourceRecordTable.realmId, realmId),
              eq(zitadelMigrationSourceRecordTable.sourceInstance, normalizeSourceInstance(sourceInstance)),
              eq(zitadelMigrationSourceRecordTable.entityType, entityType),
              eq(zitadelMigrationSourceRecordTable.sourceId, sourceId),
            ),
          )
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCodedCreate(
          "sourceRecordDelete",
          "Source record could not be deleted.",
          "zitadel-migration.write-failed",
        )
      }
    },
  }
}

export function normalizeSourceInstance(sourceInstance: string): string {
  return sourceInstance.trim().toLowerCase().replace(/\/+$/, "")
}

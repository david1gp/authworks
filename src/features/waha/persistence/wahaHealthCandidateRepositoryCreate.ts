import { and, asc, eq, gt, lte, sql } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type WahaHealthCandidateRow, wahaHealthCandidateTable } from "./wahaHealthCandidateTable.js"

type WahaHealthCandidateInsert = typeof wahaHealthCandidateTable.$inferInsert
type WahaHealthCandidateUpdate = Partial<
  Omit<WahaHealthCandidateInsert, "createdAt" | "endpointId" | "sessionName" | "version">
>

export function wahaHealthCandidateRepositoryCreate(database: StorageExecutor) {
  const wahaHealthCandidateCreateOrUpdate = (
    input: WahaHealthCandidateInsert,
    op: string,
  ): Result<WahaHealthCandidateRow> => {
    try {
      const row = database
        .insert(wahaHealthCandidateTable)
        .values(input)
        .onConflictDoUpdate({
          set: {
            checkedAt: input.checkedAt,
            expiresAt: input.expiresAt,
            failureAt: input.failureAt,
            failureCode: input.failureCode,
            failureMessage: input.failureMessage,
            status: input.status,
            updatedAt: input.updatedAt,
            version: sql`${wahaHealthCandidateTable.version} + 1`,
          },
          target: [wahaHealthCandidateTable.endpointId, wahaHealthCandidateTable.sessionName],
        })
        .returning()
        .get()
      if (row === undefined)
        return resultErrorCodedCreate(op, "The WAHA health candidate could not be written.", "waha.write-failed")
      return resultCreate(row)
    } catch (_error) {
      return resultErrorCodedCreate(op, "The WAHA health candidate could not be written.", "waha.write-failed")
    }
  }

  return {
    wahaHealthCandidateCreate(input: WahaHealthCandidateInsert): Result<WahaHealthCandidateRow> {
      return wahaHealthCandidateCreateOrUpdate(input, "wahaHealthCandidateCreate")
    },

    wahaHealthCandidateCreateOrUpdate(input: WahaHealthCandidateInsert): Result<WahaHealthCandidateRow> {
      return wahaHealthCandidateCreateOrUpdate(input, "wahaHealthCandidateCreateOrUpdate")
    },

    wahaHealthCandidateGet(endpointId: string, sessionName: string): Result<WahaHealthCandidateRow | null> {
      try {
        return resultCreate(
          database
            .select()
            .from(wahaHealthCandidateTable)
            .where(
              and(
                eq(wahaHealthCandidateTable.endpointId, endpointId),
                eq(wahaHealthCandidateTable.sessionName, sessionName),
              ),
            )
            .get() ?? null,
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "wahaHealthCandidateGet",
          "The WAHA health candidate could not be read.",
          "waha.read-failed",
        )
      }
    },

    wahaHealthCandidateList(): Result<WahaHealthCandidateRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(wahaHealthCandidateTable)
            .orderBy(asc(wahaHealthCandidateTable.endpointId), asc(wahaHealthCandidateTable.sessionName))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "wahaHealthCandidateList",
          "The WAHA health candidates could not be read.",
          "waha.read-failed",
        )
      }
    },

    wahaHealthCandidateListFreshHealthy(now: number): Result<WahaHealthCandidateRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(wahaHealthCandidateTable)
            .where(and(eq(wahaHealthCandidateTable.status, "healthy"), gt(wahaHealthCandidateTable.expiresAt, now)))
            .orderBy(asc(wahaHealthCandidateTable.endpointId), asc(wahaHealthCandidateTable.sessionName))
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "wahaHealthCandidateListFreshHealthy",
          "The fresh WAHA health candidates could not be read.",
          "waha.read-failed",
        )
      }
    },

    wahaHealthCandidateExpireStale(now: number): Result<void> {
      try {
        database
          .update(wahaHealthCandidateTable)
          .set({
            failureAt: now,
            failureCode: "waha.health-failed",
            failureMessage: "The WAHA health check has expired.",
            status: "unhealthy",
            updatedAt: now,
            version: sql`${wahaHealthCandidateTable.version} + 1`,
          })
          .where(and(eq(wahaHealthCandidateTable.status, "healthy"), lte(wahaHealthCandidateTable.expiresAt, now)))
          .run()
        return resultCreate(undefined)
      } catch (_error) {
        return resultErrorCodedCreate(
          "wahaHealthCandidateExpireStale",
          "The stale WAHA health candidates could not be expired.",
          "waha.write-failed",
        )
      }
    },

    wahaHealthCandidateMarkUnhealthy(
      endpointId: string,
      sessionName: string,
      input: {
        readonly expectedVersion: number
        readonly failureAt: number
        readonly failureCode: string
        readonly failureMessage: string
        readonly updatedAt: number
      },
    ): Result<WahaHealthCandidateRow> {
      try {
        const row = database
          .update(wahaHealthCandidateTable)
          .set({
            failureAt: input.failureAt,
            failureCode: input.failureCode,
            failureMessage: input.failureMessage,
            status: "unhealthy",
            updatedAt: input.updatedAt,
            version: input.expectedVersion + 1,
          })
          .where(
            and(
              eq(wahaHealthCandidateTable.endpointId, endpointId),
              eq(wahaHealthCandidateTable.sessionName, sessionName),
              eq(wahaHealthCandidateTable.version, input.expectedVersion),
            ),
          )
          .returning()
          .get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "wahaHealthCandidateMarkUnhealthy",
            "The WAHA health candidate was changed by another operation.",
            "waha.conflict",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "wahaHealthCandidateMarkUnhealthy",
          "The WAHA health candidate could not be marked unhealthy.",
          "waha.write-failed",
        )
      }
    },

    wahaHealthCandidateUpdate(
      endpointId: string,
      sessionName: string,
      expectedVersion: number,
      input: WahaHealthCandidateUpdate,
    ): Result<WahaHealthCandidateRow> {
      try {
        const row = database
          .update(wahaHealthCandidateTable)
          .set({ ...input, version: expectedVersion + 1 })
          .where(
            and(
              eq(wahaHealthCandidateTable.endpointId, endpointId),
              eq(wahaHealthCandidateTable.sessionName, sessionName),
              eq(wahaHealthCandidateTable.version, expectedVersion),
            ),
          )
          .returning()
          .get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "wahaHealthCandidateUpdate",
            "The WAHA health candidate was changed by another operation.",
            "waha.conflict",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "wahaHealthCandidateUpdate",
          "The WAHA health candidate could not be updated.",
          "waha.write-failed",
        )
      }
    },
  }
}

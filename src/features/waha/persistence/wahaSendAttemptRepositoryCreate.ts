import { and, desc, eq, gte, isNull, sql } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { type WahaSendAttemptRow, wahaSendAttemptTable } from "./wahaSendAttemptTable.js"

export function wahaSendAttemptRepositoryCreate(database: StorageExecutor) {
  return {
    wahaSendAttemptRecord(input: typeof wahaSendAttemptTable.$inferInsert): Result<WahaSendAttemptRow> {
      try {
        const row = database.insert(wahaSendAttemptTable).values(input).returning().get()
        if (row === undefined)
          return resultErrorCodedCreate(
            "wahaSendAttemptRecord",
            "The WAHA send attempt could not be recorded.",
            "waha.write-failed",
          )
        return resultCreate(row)
      } catch (_error) {
        return resultErrorCodedCreate(
          "wahaSendAttemptRecord",
          "The WAHA send attempt could not be recorded.",
          "waha.write-failed",
        )
      }
    },

    wahaSendAttemptSentCount(endpointId: string, sessionName: string | null, since: number): Result<number> {
      try {
        const row = database
          .select({ count: sql<number>`count(*)` })
          .from(wahaSendAttemptTable)
          .where(
            and(
              eq(wahaSendAttemptTable.endpointId, endpointId),
              sessionName === null
                ? isNull(wahaSendAttemptTable.sessionName)
                : eq(wahaSendAttemptTable.sessionName, sessionName),
              eq(wahaSendAttemptTable.status, "sent"),
              gte(wahaSendAttemptTable.createdAt, since),
            ),
          )
          .get()
        return resultCreate(row?.count ?? 0)
      } catch (_error) {
        return resultErrorCodedCreate(
          "wahaSendAttemptSentCount",
          "The WAHA sent attempts could not be counted.",
          "waha.read-failed",
        )
      }
    },

    wahaSendAttemptListRecent(limit: number, since: number): Result<WahaSendAttemptRow[]> {
      try {
        return resultCreate(
          database
            .select()
            .from(wahaSendAttemptTable)
            .where(gte(wahaSendAttemptTable.createdAt, since))
            .orderBy(desc(wahaSendAttemptTable.createdAt))
            .limit(limit)
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "wahaSendAttemptListRecent",
          "The recent WAHA send attempts could not be listed.",
          "waha.read-failed",
        )
      }
    },

    wahaSendAttemptCountByStatus(
      since: number,
    ): Result<Array<{ count: number; status: WahaSendAttemptRow["status"] }>> {
      try {
        return resultCreate(
          database
            .select({ count: sql<number>`count(*)`, status: wahaSendAttemptTable.status })
            .from(wahaSendAttemptTable)
            .where(gte(wahaSendAttemptTable.createdAt, since))
            .groupBy(wahaSendAttemptTable.status)
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "wahaSendAttemptCountByStatus",
          "The WAHA send attempts could not be counted by status.",
          "waha.read-failed",
        )
      }
    },

    wahaSendAttemptCountByPurpose(since: number): Result<Array<{ count: number; purpose: string }>> {
      try {
        return resultCreate(
          database
            .select({ count: sql<number>`count(*)`, purpose: wahaSendAttemptTable.purpose })
            .from(wahaSendAttemptTable)
            .where(gte(wahaSendAttemptTable.createdAt, since))
            .groupBy(wahaSendAttemptTable.purpose)
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "wahaSendAttemptCountByPurpose",
          "The WAHA send attempts could not be counted by purpose.",
          "waha.read-failed",
        )
      }
    },

    wahaSendAttemptSentCountBySender(
      since: number,
    ): Result<Array<{ endpointId: string; sentCount: number; sessionName: string | null }>> {
      try {
        return resultCreate(
          database
            .select({
              endpointId: wahaSendAttemptTable.endpointId,
              sentCount: sql<number>`count(*)`,
              sessionName: wahaSendAttemptTable.sessionName,
            })
            .from(wahaSendAttemptTable)
            .where(and(eq(wahaSendAttemptTable.status, "sent"), gte(wahaSendAttemptTable.createdAt, since)))
            .groupBy(wahaSendAttemptTable.endpointId, wahaSendAttemptTable.sessionName)
            .all(),
        )
      } catch (_error) {
        return resultErrorCodedCreate(
          "wahaSendAttemptSentCountBySender",
          "The WAHA sent attempts could not be counted by sender.",
          "waha.read-failed",
        )
      }
    },
  }
}

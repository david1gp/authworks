import { sql } from "drizzle-orm"
import { type Result } from "#result"
import { eventUserSubjectTable } from "../../features/events/persistence/eventUserSubjectTable.js"
import { resultCreate } from "../errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../errors/resultErrorCodedCreate.js"
import { storageEventPurgeTable } from "./storageEventPurgeTable.js"
import { storageEventTable } from "./storageEventTable.js"
import type { StorageTransaction } from "./storageSchema.js"

// Design: purge gate is a *table*, not a flag. The append-only delete trigger
// aborts unless OLD.aggregate_id is present in event_purges; the purge helper
// inserts ids, deletes events, then clears the gate — all inside the caller's
// transaction, so a crash cannot leave the gate open. user-subject rows are
// covered two ways: (1) rows whose event_position belongs to a purged
// aggregate cascade via the events FK, (2) rows for purged users on OTHER
// aggregates are deleted explicitly via event_user_subjects.user_id FIRST,
// then the events at those foreign positions are deleted through the events
// table after registering their aggregate ids in the gate.
export function storageEventsPurge(
  transaction: StorageTransaction,
  aggregateIds: readonly string[],
  userIds: readonly string[] = [],
): Result<{ deleted: number }> {
  const op = "storageEventsPurge"
  const aggregates = [...new Set(aggregateIds.filter((id) => id.length > 0))]
  const users = [...new Set(userIds.filter((id) => id.length > 0))]
  if (aggregates.length === 0 && users.length === 0) return resultCreate({ deleted: 0 })
  try {
    transaction.run(sql`CREATE TABLE IF NOT EXISTS event_purges (aggregate_id TEXT PRIMARY KEY NOT NULL)`)
    for (const aggregateId of aggregates) {
      transaction.insert(storageEventPurgeTable).values({ aggregateId }).onConflictDoNothing().run()
    }
    let deleted = 0
    for (const aggregateId of aggregates) {
      const removed = transaction
        .delete(storageEventTable)
        .where(sql`aggregate_id = ${aggregateId}`)
        .returning({ position: storageEventTable.position })
        .all()
      deleted += removed.length
    }
    for (const userId of users) {
      transaction.insert(storageEventPurgeTable).values({ aggregateId: userId }).onConflictDoNothing().run()
      // Foreign-aggregate events that name the purged user (e.g.
      // session.created for a login): register their aggregate ids in the
      // gate, then delete the subject rows and the events themselves.
      const foreignAggregates = transaction
        .selectDistinct({ aggregateId: storageEventTable.aggregateId })
        .from(storageEventTable)
        .innerJoin(eventUserSubjectTable, sql`${eventUserSubjectTable.eventPosition} = ${storageEventTable.position}`)
        .where(sql`${eventUserSubjectTable.userId} = ${userId}`)
        .all()
      for (const row of foreignAggregates) {
        if (typeof row.aggregateId === "string" && row.aggregateId.length > 0) {
          transaction
            .insert(storageEventPurgeTable)
            .values({ aggregateId: row.aggregateId })
            .onConflictDoNothing()
            .run()
        }
      }
      transaction.run(sql`DELETE FROM event_user_subjects WHERE user_id = ${userId}`)
      for (const row of foreignAggregates) {
        if (typeof row.aggregateId !== "string" || row.aggregateId.length === 0) continue
        const removed = transaction
          .delete(storageEventTable)
          .where(sql`aggregate_id = ${row.aggregateId}`)
          .returning({ position: storageEventTable.position })
          .all()
        deleted += removed.length
      }
      const removed = transaction
        .delete(storageEventTable)
        .where(sql`aggregate_id = ${userId}`)
        .returning({ position: storageEventTable.position })
        .all()
      deleted += removed.length
    }
    transaction.run(sql`DELETE FROM event_purges`)
    return resultCreate({ deleted })
  } catch (_error) {
    return resultErrorCreate(op, "The events could not be purged.", "platform.unavailable")
  }
}

import { and, desc, eq, inArray, lt } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { type StorageEvent, storageEventTable } from "../../../platform/storage/storageEventTable.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { eventSecurityEventDefinitionByType } from "../domain/eventSecurityEventDefinitionByType.js"
import { eventUserSubjectTable } from "./eventUserSubjectTable.js"

export function eventRepositoryCreate(database: StorageExecutor) {
  return {
    eventList(realmId: string): Result<StorageEvent[]> {
      try {
        return resultCreate(
          database.select().from(storageEventTable).where(eq(storageEventTable.realmId, realmId)).all(),
        )
      } catch (_error) {
        return resultErrorCreate("eventList", "The events could not be read.", "events.read-failed")
      }
    },
    eventUserSecurityHistoryList(realmId: string, userId: string, positionBefore: number | undefined, limit: number) {
      try {
        const coveredEventTypes = Object.keys(eventSecurityEventDefinitionByType)
        const rows = database
          .select({
            actorId: storageEventTable.actorId,
            category: eventUserSubjectTable.category,
            displayCode: eventUserSubjectTable.displayCode,
            eventType: storageEventTable.eventType,
            id: storageEventTable.id,
            occurredAt: storageEventTable.occurredAt,
            position: storageEventTable.position,
            subjectId: eventUserSubjectTable.userId,
          })
          .from(eventUserSubjectTable)
          .innerJoin(storageEventTable, eq(storageEventTable.position, eventUserSubjectTable.eventPosition))
          .where(
            and(
              eq(eventUserSubjectTable.realmId, realmId),
              eq(eventUserSubjectTable.userId, userId),
              eq(eventUserSubjectTable.eventType, storageEventTable.eventType),
              inArray(eventUserSubjectTable.eventType, coveredEventTypes),
              ...(positionBefore === undefined ? [] : [lt(storageEventTable.position, positionBefore)]),
            ),
          )
          .orderBy(desc(storageEventTable.position))
          .limit(limit)
          .all()
        return resultCreate(rows)
      } catch (_error) {
        return resultErrorCreate(
          "eventUserSecurityHistoryList",
          "The security history could not be read.",
          "events.read-failed",
        )
      }
    },
  }
}

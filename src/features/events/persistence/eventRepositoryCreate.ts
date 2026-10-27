import { and, desc, eq, gte, inArray, lt, lte } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { type StorageEvent, storageEventTable } from "../../../platform/storage/storageEventTable.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { eventSecurityEventDefinitionByType } from "../domain/eventSecurityEventDefinitionByType.js"
import { eventUserSubjectTable } from "./eventUserSubjectTable.js"

export type EventListFilters = {
  readonly actorId?: string
  readonly aggregateId?: string
  readonly aggregateType?: string
  readonly eventType?: string
  readonly occurredFrom?: number
  readonly occurredTo?: number
  readonly userSubjectId?: string
}

export function eventRepositoryCreate(database: StorageExecutor) {
  return {
    eventList(realmId: string, filters?: EventListFilters): Result<StorageEvent[]> {
      try {
        const conditions = [eq(storageEventTable.realmId, realmId)]
        if (filters?.eventType !== undefined) conditions.push(eq(storageEventTable.eventType, filters.eventType))
        if (filters?.aggregateType !== undefined)
          conditions.push(eq(storageEventTable.aggregateType, filters.aggregateType))
        if (filters?.aggregateId !== undefined) conditions.push(eq(storageEventTable.aggregateId, filters.aggregateId))
        if (filters?.actorId !== undefined) conditions.push(eq(storageEventTable.actorId, filters.actorId))
        if (filters?.occurredFrom !== undefined)
          conditions.push(gte(storageEventTable.occurredAt, filters.occurredFrom))
        if (filters?.occurredTo !== undefined) conditions.push(lte(storageEventTable.occurredAt, filters.occurredTo))
        if (filters?.userSubjectId !== undefined) {
          const positions = database
            .select({ eventPosition: eventUserSubjectTable.eventPosition })
            .from(eventUserSubjectTable)
            .where(
              and(eq(eventUserSubjectTable.realmId, realmId), eq(eventUserSubjectTable.userId, filters.userSubjectId)),
            )
            .all()
            .map((row) => row.eventPosition)
          if (positions.length === 0) return resultCreate([])
          conditions.push(inArray(storageEventTable.position, positions))
        }
        return resultCreate(
          database
            .select()
            .from(storageEventTable)
            .where(and(...conditions))
            .all(),
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
            payload: storageEventTable.payload,
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

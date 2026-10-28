import { and, asc, desc, eq, gt, gte, inArray, lt, lte, or, type SQL } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { listCursorDecode } from "../../../platform/http/listCursorDecode.js"
import { listPageSizeResolve } from "../../../platform/http/listPageSizeResolve.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import { type StorageEvent, storageEventTable } from "../../../platform/storage/storageEventTable.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { eventSecurityEventDefinitionByType } from "../domain/eventSecurityEventDefinitionByType.js"
import type { EventListQuery } from "../public/eventListQuerySchema.js"
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
    eventOrganizationPage(realmId: string, ownership: SQL, query?: EventListQuery): Result<StorageEvent[]> {
      const sortBy = listSortByResolve(query?.sortBy, ["occurredAt", "id"], "occurredAt")
      if (!sortBy.success) return sortBy
      const cursor = query?.pageToken === undefined ? undefined : listCursorDecode(query.pageToken)
      if (cursor !== undefined && !cursor.success) return cursor
      try {
        const event = storageEventTable
        const conditions: SQL[] = [eq(event.realmId, realmId), ownership]
        if (query?.eventType !== undefined) conditions.push(eq(event.eventType, query.eventType))
        if (query?.aggregateType !== undefined) conditions.push(eq(event.aggregateType, query.aggregateType))
        if (query?.aggregateId !== undefined) conditions.push(eq(event.aggregateId, query.aggregateId))
        if (query?.actorId !== undefined) conditions.push(eq(event.actorId, query.actorId))
        if (query?.occurredFrom !== undefined) conditions.push(gte(event.occurredAt, query.occurredFrom))
        if (query?.occurredTo !== undefined) conditions.push(lte(event.occurredAt, query.occurredTo))
        if (query?.userSubjectId !== undefined) {
          conditions.push(
            inArray(
              event.position,
              database
                .select({ position: eventUserSubjectTable.eventPosition })
                .from(eventUserSubjectTable)
                .where(
                  and(
                    eq(eventUserSubjectTable.realmId, realmId),
                    eq(eventUserSubjectTable.userId, query.userSubjectId),
                  ),
                ),
            ),
          )
        }
        const descending = (query?.sortDirection ?? "desc") === "desc"
        const compare = descending ? lt : gt
        const sort = descending ? desc : asc
        if (cursor?.success) {
          const key = cursor.data.k
          if (key === null) return resultCreate([])
          if (sortBy.data === "id") {
            conditions.push(
              or(compare(event.id, String(key)), and(eq(event.id, String(key)), compare(event.id, cursor.data.id)))!,
            )
          } else if (typeof key === "number") {
            conditions.push(
              or(compare(event.occurredAt, key), and(eq(event.occurredAt, key), compare(event.id, cursor.data.id)))!,
            )
          } else {
            // Non-numeric cursors cannot arise from this sort; preserve cursor validation without widening scope.
            return resultCreate([])
          }
        }
        return resultCreate(
          database
            .select()
            .from(event)
            .where(and(...conditions))
            .orderBy(sort(sortBy.data === "id" ? event.id : event.occurredAt), sort(event.id))
            .limit(listPageSizeResolve(query?.pageSize) + 1)
            .all(),
        )
      } catch (_error) {
        return resultErrorCreate("eventOrganizationPage", "The events could not be read.", "events.read-failed")
      }
    },
    eventList(realmId: string, filters?: EventListFilters, ownership?: SQL): Result<StorageEvent[]> {
      try {
        const conditions = [eq(storageEventTable.realmId, realmId)]
        if (ownership !== undefined) conditions.push(ownership)
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

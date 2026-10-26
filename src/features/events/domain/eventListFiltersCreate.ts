import type { EventListFilters } from "../persistence/eventRepositoryCreate.js"
import type { EventListQuery } from "../public/eventListQuerySchema.js"

export function eventListFiltersCreate(query: EventListQuery | undefined): EventListFilters {
  return {
    ...(query?.actorId === undefined ? {} : { actorId: query.actorId }),
    ...(query?.aggregateId === undefined ? {} : { aggregateId: query.aggregateId }),
    ...(query?.aggregateType === undefined ? {} : { aggregateType: query.aggregateType }),
    ...(query?.eventType === undefined ? {} : { eventType: query.eventType }),
    ...(query?.occurredFrom === undefined ? {} : { occurredFrom: query.occurredFrom }),
    ...(query?.occurredTo === undefined ? {} : { occurredTo: query.occurredTo }),
    ...(query?.userSubjectId === undefined ? {} : { userSubjectId: query.userSubjectId }),
  }
}

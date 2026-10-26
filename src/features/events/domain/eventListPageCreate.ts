import { type Result } from "#result"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { Event } from "../public/eventSchema.js"
import type { EventListQuery } from "../public/eventListQuerySchema.js"
import type { EventListResponse } from "../public/eventListResponseSchema.js"

type EventListPageCreateOptions = {
  readonly events: readonly Event[]
  readonly query?: EventListQuery
}

export function eventListPageCreate(options: EventListPageCreateOptions): Result<EventListResponse> {
  const sortBy = listSortByResolve(options.query?.sortBy, ["occurredAt", "id"], "occurredAt")
  if (!sortBy.success) return sortBy
  return listRowsPage({
    idGet: (event) => event.id,
    query: options.query,
    rows: options.events,
    sortDirection: options.query?.sortDirection ?? "desc",
    sortValueGet: (event) => (sortBy.data === "id" ? event.id : event.occurredAt),
  })
}

import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { eventPublicViewCreate } from "../domain/eventPublicViewCreate.js"
import { eventRepositoryCreate } from "../persistence/eventRepositoryCreate.js"
import type { EventListResponse } from "../public/eventListResponseSchema.js"

type EventListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly query?: ListQuery
}

export function eventList(options: EventListOptions): Result<EventListResponse> {
  const op = "eventList"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "events.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The events are not available in this tenant context.", "events.tenant-mismatch")
  const events = eventRepositoryCreate(options.database.db).eventList(options.realmId)
  if (!events.success) return events
  const sortBy = listSortByResolve(options.query?.sortBy, ["occurredAt", "id"], "occurredAt")
  if (!sortBy.success) return sortBy
  return listRowsPage({
    idGet: (event) => event.id,
    query: options.query,
    rows: events.data.map(eventPublicViewCreate),
    sortDirection: options.query?.sortDirection ?? "desc",
    sortValueGet: (event) => (sortBy.data === "id" ? event.id : event.occurredAt),
  })
}

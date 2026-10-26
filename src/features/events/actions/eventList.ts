import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { eventAuthorizedRead } from "../domain/eventAuthorizedRead.js"
import { eventListFiltersCreate } from "../domain/eventListFiltersCreate.js"
import { eventListPageCreate } from "../domain/eventListPageCreate.js"
import type { EventListQuery } from "../public/eventListQuerySchema.js"
import type { EventListResponse } from "../public/eventListResponseSchema.js"

type EventListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly query?: EventListQuery
}

export function eventList(options: EventListOptions): Result<EventListResponse> {
  const op = "eventList"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "events.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The events are not available in this tenant context.", "events.tenant-mismatch")
  const events = eventAuthorizedRead({
    context: options.context,
    database: options.database,
    filters: eventListFiltersCreate(options.query),
    realmId: options.realmId,
  })
  if (!events.success) return events
  return eventListPageCreate({ events: events.data, query: options.query })
}

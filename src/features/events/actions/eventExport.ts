import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { eventAuthorizedRead } from "../domain/eventAuthorizedRead.js"
import { eventListFiltersCreate } from "../domain/eventListFiltersCreate.js"
import { eventExportResponseSchema, type EventExportResponse } from "../public/eventExportResponseSchema.js"
import type { EventListQuery } from "../public/eventListQuerySchema.js"

type EventExportOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly query?: EventListQuery
}

const eventExportLimit = 10_000

export function eventExport(options: EventExportOptions): Result<EventExportResponse> {
  const op = "eventExport"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.", "events.tenant-required")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The events are not available in this tenant context.", "events.tenant-mismatch")
  const sortBy = listSortByResolve(options.query?.sortBy, ["occurredAt", "id"], "occurredAt")
  if (!sortBy.success) return sortBy
  const events = eventAuthorizedRead({
    context: options.context,
    database: options.database,
    filters: eventListFiltersCreate(options.query),
    realmId: options.realmId,
  })
  if (!events.success) return events
  const direction = options.query?.sortDirection ?? "desc"
  const sorted = [...events.data].sort((left, right) => {
    const leftValue = sortBy.data === "id" ? left.id : left.occurredAt
    const rightValue = sortBy.data === "id" ? right.id : right.occurredAt
    const compared =
      typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue))
    if (compared !== 0) return direction === "desc" ? -compared : compared
    return direction === "desc" ? right.id.localeCompare(left.id) : left.id.localeCompare(right.id)
  })
  const truncated = sorted.length > eventExportLimit
  const parsed = v.safeParse(eventExportResponseSchema, {
    items: truncated ? sorted.slice(0, eventExportLimit) : sorted,
    truncated,
  })
  if (!parsed.success) return resultErrorCreate("eventExport", "The event export is invalid.", "events.invalid")
  return resultCreate(parsed.output)
}

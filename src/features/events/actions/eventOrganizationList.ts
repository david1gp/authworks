import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { listPageFromRows } from "../../../platform/http/listPageFromRows.js"
import { listPageSizeResolve } from "../../../platform/http/listPageSizeResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationActivityAuthorize } from "../../organizations/server/organizationActivityAuthorize.js"
import { organizationActivityOwnershipPredicateCreate } from "../../organizations/server/organizationActivityOwnershipPredicateCreate.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { eventPublicViewCreate } from "../domain/eventPublicViewCreate.js"
import { eventRepositoryCreate } from "../persistence/eventRepositoryCreate.js"
import type { EventListQuery } from "../public/eventListQuerySchema.js"
import type { EventListResponse } from "../public/eventListResponseSchema.js"

export function eventOrganizationList(options: {
  context: RealmTenantContext
  database: StorageDatabase
  realmId: string
  organizationId: string
  query?: EventListQuery
}): Result<EventListResponse> {
  const authorized = organizationActivityAuthorize(options)
  if (!authorized.success) return authorized
  const events = eventRepositoryCreate(options.database.db).eventOrganizationPage(
    options.realmId,
    organizationActivityOwnershipPredicateCreate(options.realmId, options.organizationId),
    options.query,
  )
  if (!events.success) return events
  return resultCreate(
    listPageFromRows({
      rows: events.data.map(eventPublicViewCreate),
      pageSize: listPageSizeResolve(options.query?.pageSize),
      idGet: (event) => event.id,
      sortValueGet: (event) => (options.query?.sortBy === "id" ? event.id : event.occurredAt),
    }),
  )
}

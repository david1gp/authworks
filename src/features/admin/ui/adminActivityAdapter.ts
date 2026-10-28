import type { Result } from "#result"
import type { EventListQuery } from "../../events/public/eventListQuerySchema.js"
import type { EventListResponse } from "../../events/public/eventListResponseSchema.js"

export type AdminActivityAdapter = {
  readonly organizationList: (
    realmId: string,
    organizationId: string,
    query: EventListQuery,
  ) => Promise<Result<EventListResponse>>
  readonly realmList: (realmId: string, query: EventListQuery) => Promise<Result<EventListResponse>>
}

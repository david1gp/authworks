import { createResult } from "#result"
import type { Event } from "../../events/public/eventSchema.js"
import type { AdminActivityAdapter } from "./adminActivityAdapter.js"

/** Fixtures are explicitly scoped; organization activity must never reuse the realm feed. */
export function adminActivityDemoAdapterCreate(options: {
  readonly realmEvents: readonly Event[]
  readonly organizationEvents: Readonly<Record<string, readonly Event[]>>
}): AdminActivityAdapter {
  const page = (events: readonly Event[], size: number, token?: string) => {
    const offset = token === undefined ? 0 : Number(token)
    const items = events.slice(offset, offset + size)
    return createResult({ items, nextPageToken: offset + size < events.length ? String(offset + size) : undefined })
  }
  return {
    organizationList: async (_realmId, organizationId, query) =>
      page(options.organizationEvents[organizationId] ?? [], query.pageSize ?? 20, query.pageToken),
    realmList: async (_realmId, query) => page(options.realmEvents, query.pageSize ?? 20, query.pageToken),
  }
}

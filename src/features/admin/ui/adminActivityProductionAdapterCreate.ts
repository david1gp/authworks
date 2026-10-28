import type { eventApiClientCreate } from "../../events/client/eventApiClientCreate.js"
import type { AdminActivityAdapter } from "./adminActivityAdapter.js"

export function adminActivityProductionAdapterCreate(
  client: ReturnType<typeof eventApiClientCreate>,
): AdminActivityAdapter {
  return { organizationList: client.eventOrganizationList, realmList: client.eventTenantList }
}

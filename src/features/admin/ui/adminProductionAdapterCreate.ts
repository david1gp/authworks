import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { AdminAdapter } from "./adminAdapter.js"
import type { adminApiCreate } from "./adminApiCreate.js"
import { adminSessionProductionAdapterCreate } from "./adminSessionProductionAdapterCreate.js"

/** Binds core administration to real cookie/CSRF browser APIs for the authenticated realm. */
export function adminProductionAdapterCreate(options: {
  readonly api: ReturnType<typeof adminApiCreate>
  readonly realmId: () => string
}): AdminAdapter {
  const api = options.api
  const missingRealm = (op: string) =>
    resultErrorCodedCreate(op, "The administered realm could not be resolved.", "realms.tenant-required")
  const realmRequired = <T>(op: string, run: (realmId: string) => Promise<T>) => {
    const realmId = options.realmId()
    if (realmId.length === 0) return Promise.resolve(missingRealm(op))
    return run(realmId)
  }

  return {
    ...adminSessionProductionAdapterCreate({ api, realmId: options.realmId }),
    eventList: (query) => realmRequired("adminEventList", (realmId) => api.eventList(realmId, query)),
    realmGet: () => realmRequired("adminRealmGet", (realmId) => api.realmGet(realmId)),
    realmUpdate: (input) => realmRequired("adminRealmUpdate", (realmId) => api.realmUpdate(realmId, input)),
  }
}

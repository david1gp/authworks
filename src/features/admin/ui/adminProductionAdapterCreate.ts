import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { AdminAdapter } from "./adminAdapter.js"
import type { adminApiCreate } from "./adminApiCreate.js"
import { adminSessionProductionAdapterCreate } from "./adminSessionProductionAdapterCreate.js"
import type { AdminUserSecurityAdapter } from "./adminUserSecurityAdapter.js"

/** Binds core administration to real cookie/CSRF browser APIs for the authenticated realm. */
export function adminProductionAdapterCreate(options: {
  readonly api: ReturnType<typeof adminApiCreate>
  readonly realmId: () => string
}): AdminAdapter & AdminUserSecurityAdapter {
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
    userCreate: (input) => realmRequired("adminUserCreate", (realmId) => api.userCreate(realmId, input)),
    userDelete: (userId) => realmRequired("adminUserDelete", (realmId) => api.userDelete(realmId, userId)),
    userGet: async (userId) => {
      const result = await realmRequired("adminUserGet", (realmId) => api.userGet(realmId, userId))
      if (!result.success) return result
      if ("status" in result && result.status === "unchanged")
        return resultErrorCodedCreate("adminUserGet", "The user response was unchanged.", "platform.invalid-response")
      return resultCreate(result.data)
    },
    userLifecycleSet: (userId, input) =>
      realmRequired("adminUserLifecycleSet", (realmId) => api.userLifecycleSet(realmId, userId, input)),
    userList: (query) => realmRequired("adminUserList", (realmId) => api.userList(realmId, query)),
    userProfileUpdate: (userId, input) =>
      realmRequired("adminUserProfileUpdate", (realmId) => api.userProfileUpdate(realmId, userId, input)),
    userVerificationSet: (userId, input) =>
      realmRequired("adminUserVerificationSet", (realmId) => api.userVerificationSet(realmId, userId, input)),
    userAuthenticationMethodsGet: (userId) =>
      realmRequired("adminUserAuthenticationMethodsGet", (realmId) =>
        api.userAuthenticationMethodsGet(realmId, userId),
      ),
    userSessionRevoke: (userId, sessionId) =>
      realmRequired("adminUserSessionRevoke", (realmId) => api.userSessionRevoke(realmId, userId, sessionId)),
    userSessionsList: (userId, query) =>
      realmRequired("adminUserSessionsList", (realmId) => api.userSessionsList(realmId, userId, query)),
  }
}

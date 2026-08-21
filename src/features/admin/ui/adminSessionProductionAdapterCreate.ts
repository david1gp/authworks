import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { AdminAdapter } from "./adminAdapter.js"
import type { adminApiCreate } from "./adminApiCreate.js"

/**
 * Binds administrator sign-in and session inspection to the real browser session APIs. The
 * bootstrap credential is passed straight through to the exchange and is never persisted.
 */
export function adminSessionProductionAdapterCreate(options: {
  readonly api: ReturnType<typeof adminApiCreate>
  readonly realmId: () => string
}): Pick<AdminAdapter, "adminSignIn" | "adminSignOut" | "sessionCurrent"> {
  const missingRealm = (op: string) =>
    resultErrorCodedCreate(op, "The administered realm could not be resolved.", "realms.tenant-required")

  return {
    adminSignIn: async (secret) => {
      const realmId = options.realmId()
      if (realmId.length === 0) return missingRealm("adminSignIn")
      const result = await options.api.adminSignIn(realmId, secret)
      if (!result.success) return result
      return resultCreate({
        expiresAt: result.data.expiresAt,
        sessionId: result.data.sessionId,
        subjectId: result.data.adminId,
        subjectType: "bootstrap_admin" as const,
      })
    },
    adminSignOut: async () => {
      const realmId = options.realmId()
      if (realmId.length === 0) return missingRealm("adminSignOut")
      const result = await options.api.adminSignOut(realmId)
      if (!result.success) return result
      return resultCreate({ revoked: result.data.revoked })
    },
    sessionCurrent: async () => {
      const realmId = options.realmId()
      if (realmId.length === 0) return missingRealm("adminSessionCurrent")
      const result = await options.api.sessionCurrent(realmId)
      if (!result.success) return result
      return resultCreate({
        expiresAt: result.data.session.expiresAt,
        sessionId: result.data.session.id,
        subjectId: result.data.session.subjectId,
        subjectType: result.data.session.subjectType,
      })
    },
  }
}

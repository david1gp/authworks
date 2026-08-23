import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { sessionCsrfTokenGet } from "../../sessions/client/sessionCsrfTokenGet.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import type { User } from "../../users/public/userSchema.js"
import type {
  ImpersonationAdminAdapter,
  ImpersonationAdminOrganizationOption,
  ImpersonationAdminSession,
} from "./impersonationAdminAdapter.js"
import { impersonationAdminApiCreate } from "./impersonationAdminApiCreate.js"
import { impersonationAdminUserLabel } from "./impersonationAdminUserLabel.js"

const pageSize = 50

/**
 * Production adapter. Every call is realm-scoped and cookie-authenticated, so permission,
 * assurance, nesting, and tenant boundaries are enforced by the server rather than the view.
 * The impersonation session credential returned by the start contract is deliberately
 * discarded here: it is never stored, logged, or handed to a view.
 */
export function impersonationAdminProductionAdapterCreate(options: {
  readonly baseUrl: string
  readonly csrfToken?: () => string | undefined
  readonly fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  readonly realmId: () => string
}): ImpersonationAdminAdapter {
  const apiCreate = (csrfToken?: string) =>
    impersonationAdminApiCreate({
      baseUrl: options.baseUrl,
      ...(csrfToken === undefined ? {} : { csrfToken }),
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    })
  const api = () => apiCreate(options.csrfToken?.())
  const realm = () => options.realmId()
  const missingRealm = (op: string) =>
    resultErrorCodedCreate(op, "The administered realm could not be resolved.", "impersonation.invalid")

  /** Resolves a fresh realm-scoped CSRF token per mutation so a rotated session never replays one. */
  const mutate = async <T>(run: (client: ReturnType<typeof apiCreate>) => Promise<Result<T>>): Promise<Result<T>> => {
    const provided = options.csrfToken?.()
    if (provided !== undefined) return run(apiCreate(provided))
    const csrf = await sessionCsrfTokenGet({
      baseUrl: options.baseUrl,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      realmId: realm(),
    })
    if (!csrf.success) return csrf
    return run(apiCreate(csrf.data))
  }

  const userLabelResolve = async (userId: string): Promise<string> => {
    const result = await api().users.userTenantGet(realm(), userId)
    if (!result.success) return userId
    return impersonationAdminUserLabel(result.data.user)
  }

  const sessionMap = async (session: Session, actorLabel?: string): Promise<ImpersonationAdminSession> => {
    const subjectId = session.userId ?? session.subjectId
    const impersonatorId = session.impersonatorId ?? session.subjectId
    return {
      actorId: impersonatorId,
      actorLabel: actorLabel ?? (await userLabelResolve(impersonatorId)),
      expiresAt: session.expiresAt,
      ...(session.impersonationOrganizationId === undefined
        ? {}
        : { organizationId: session.impersonationOrganizationId }),
      ...(session.impersonationReason === undefined ? {} : { reason: session.impersonationReason }),
      sessionId: session.id,
      startedAt: session.createdAt,
      subjectId,
      subjectLabel: await userLabelResolve(subjectId),
    }
  }

  return {
    activeGet: async () => {
      const realmId = realm()
      if (realmId.length === 0) return missingRealm("impersonationAdminActiveGet")
      const current = await api().sessions.sessionCurrent(realmId)
      if (!current.success) return current
      if (current.data.session.impersonatorId === undefined) return resultCreate(null)
      return resultCreate(await sessionMap(current.data.session))
    },
    eligibilityGet: async () => {
      const realmId = realm()
      if (realmId.length === 0) return missingRealm("impersonationAdminEligibilityGet")
      const current = await api().sessions.sessionCurrent(realmId)
      if (!current.success) return current
      const session = current.data.session
      const nested = session.impersonatorId !== undefined
      const actorLabel = session.subjectType === "user" ? await userLabelResolve(session.subjectId) : session.subjectId
      return resultCreate({
        actorId: session.subjectId,
        actorLabel,
        assurance: session.assurance,
        nested,
        // The server re-checks the impersonate permission on every start; this is only a hint.
        permitted: !nested && (session.subjectType === "bootstrap_admin" || session.assurance === "multi_factor"),
      })
    },
    impersonationEnd: async (sessionId) => {
      const realmId = realm()
      if (realmId.length === 0) return missingRealm("impersonationAdminEnd")
      const result = await mutate((client) => client.impersonation.impersonationEnd(realmId, sessionId))
      if (!result.success) return result
      return resultCreate({ ended: result.data.ended, sessionId: result.data.sessionId })
    },
    impersonationStart: async (input) => {
      const realmId = realm()
      if (realmId.length === 0) return missingRealm("impersonationAdminStart")
      const result = await mutate((client) => client.impersonation.impersonationStart(realmId, input))
      if (!result.success) return result
      // Only the session metadata crosses this boundary; the issued token is dropped here.
      return resultCreate(await sessionMap(result.data.session))
    },
    organizationList: async () => {
      const realmId = realm()
      if (realmId.length === 0) return missingRealm("impersonationAdminOrganizationList")
      const result = await api().organizations.organizationTenantList(realmId, { pageSize })
      if (!result.success) return result
      const options: readonly ImpersonationAdminOrganizationOption[] = result.data.items.map((organization) => ({
        id: organization.id,
        name: organization.name,
      }))
      return resultCreate(options)
    },
    userList: async () => {
      const realmId = realm()
      if (realmId.length === 0) return missingRealm("impersonationAdminUserList")
      const result = await api().users.userTenantList(realmId, { pageSize })
      if (!result.success) return result
      const users: readonly User[] = result.data.items
      return resultCreate(users)
    },
  }
}

import { createEffect, on } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { Session } from "../../sessions/public/sessionSchema.js"
import type { UserAuthenticationMethods } from "../../users/public/userAuthenticationMethodsSchema.js"
import type { AdminUserSecurityAdapter } from "./adminUserSecurityAdapter.js"
import type { AdminViewStatus } from "./adminViewStatusSchema.js"

type FailedResult = { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }

const statusForFailure = (result: FailedResult): AdminViewStatus => {
  if (result.code === "sessions.unauthorized" || result.statusCode === 401) return "expired"
  if (result.code === "realms.forbidden" || result.statusCode === 403) return "permission-denied"
  return "error"
}

/** Owns independent administrator reads and revocation state for one user's security metadata. */
export function adminUserSecurityStateCreate(options: {
  readonly adapter: AdminUserSecurityAdapter
  readonly confirm: (message: string) => boolean
  readonly reloadKey?: () => string
  readonly userId: () => string | undefined
}) {
  const methods = createSignalObject<UserAuthenticationMethods | undefined>(undefined)
  const methodsError = createSignalObject<string | undefined>(undefined)
  const methodsStatus = createSignalObject<AdminViewStatus>("loading")
  const sessions = createSignalObject<readonly Session[]>([])
  const sessionsError = createSignalObject<string | undefined>(undefined)
  const sessionsStatus = createSignalObject<AdminViewStatus>("loading")
  const pendingSessionId = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)

  const methodsLoad = async (userId: string) => {
    methodsStatus.set("loading")
    methodsError.set(undefined)
    const result = await options.adapter.userAuthenticationMethodsGet(userId)
    if (!result.success) {
      methodsError.set(result.errorMessage)
      return methodsStatus.set(statusForFailure(result))
    }
    methods.set(result.data)
    const empty =
      !result.data.emailOtp.available &&
      result.data.passkeys.credentials.length === 0 &&
      !result.data.recoveryCodes.available &&
      !result.data.totp.enrolled
    methodsStatus.set(empty ? "empty" : "ready")
  }
  const sessionsLoad = async (userId: string) => {
    sessionsStatus.set("loading")
    sessionsError.set(undefined)
    const result = await options.adapter.userSessionsList(userId)
    if (!result.success) {
      sessionsError.set(result.errorMessage)
      return sessionsStatus.set(statusForFailure(result))
    }
    sessions.set(result.data.items.filter((session) => session.revokedAt === null))
    sessionsStatus.set(sessions.get().length === 0 ? "empty" : "ready")
  }
  const load = () => {
    const userId = options.userId()
    notice.set(undefined)
    if (userId === undefined || userId.length === 0) return
    void methodsLoad(userId)
    void sessionsLoad(userId)
  }

  createEffect(on(() => `${options.userId() ?? ""}:${options.reloadKey?.() ?? ""}`, load))

  return {
    methods: methods.get,
    methodsError: methodsError.get,
    methodsReload: () => {
      const userId = options.userId()
      if (userId !== undefined) void methodsLoad(userId)
    },
    methodsStatus: methodsStatus.get,
    notice: notice.get,
    pendingSessionId: pendingSessionId.get,
    sessionRevoke: async (sessionId: string) => {
      const userId = options.userId()
      if (userId === undefined) return
      if (!options.confirm(messageTranslate("admin.users.sessions.revokeConfirm"))) return
      pendingSessionId.set(sessionId)
      sessionsError.set(undefined)
      const result = await options.adapter.userSessionRevoke(userId, sessionId)
      pendingSessionId.set(undefined)
      if (!result.success) {
        sessionsError.set(result.errorMessage)
        return sessionsStatus.set(statusForFailure(result))
      }
      sessions.set(sessions.get().filter((session) => session.id !== sessionId))
      sessionsStatus.set(sessions.get().length === 0 ? "empty" : "ready")
      notice.set(messageTranslate("admin.users.sessions.revoked"))
    },
    sessions: sessions.get,
    sessionsError: sessionsError.get,
    sessionsReload: () => {
      const userId = options.userId()
      if (userId !== undefined) void sessionsLoad(userId)
    },
    sessionsStatus: sessionsStatus.get,
  }
}

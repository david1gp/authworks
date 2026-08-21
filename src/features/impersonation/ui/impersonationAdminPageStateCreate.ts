import { createEffect, on } from "solid-js"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { User } from "../../users/public/userSchema.js"
import type {
  ImpersonationAdminAdapter,
  ImpersonationAdminEligibility,
  ImpersonationAdminOrganizationOption,
  ImpersonationAdminSession,
} from "./impersonationAdminAdapter.js"
import { impersonationAdminDurationBounds } from "./impersonationAdminDurationBounds.js"
import { impersonationAdminFailureStatusSelect } from "./impersonationAdminFailureStatusSelect.js"
import { impersonationAdminUserLabel } from "./impersonationAdminUserLabel.js"
import type { ImpersonationAdminStatus } from "./impersonationAdminStatusSchema.js"

type FailedResult = { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }

type ImpersonationAdminPageStateOptions = {
  readonly adapter: ImpersonationAdminAdapter
  readonly confirm: (message: string) => boolean
  /** Renders the ended confirmation without a prior mutation, so the state is URL-reachable. */
  readonly endedSeed?: () => boolean
  /** Injected so remaining-time display is deterministic in tests and demo fixtures. */
  readonly now: () => number
  /** Reactive key forcing a reload, such as the selected demo fixture state. */
  readonly reloadKey?: () => string
  /** The user the guarded start form is pre-bound to, when opened from a user detail page. */
  readonly targetUserId?: () => string | undefined
}

/**
 * Shared, adapter-agnostic state for the guarded impersonation controls and the persistent
 * banner. Views read only from here, so production and demo render identically.
 *
 * Nested impersonation is refused before any request is made and narrated to the operator,
 * and no session credential is ever held by this factory.
 */
export function impersonationAdminPageStateCreate(options: ImpersonationAdminPageStateOptions) {
  const adapter = options.adapter
  const status = createSignalObject<ImpersonationAdminStatus>("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)
  const validationMessage = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const eligibility = createSignalObject<ImpersonationAdminEligibility | undefined>(undefined)
  const active = createSignalObject<ImpersonationAdminSession | null>(null)
  const users = createSignalObject<readonly User[]>([])
  const organizations = createSignalObject<readonly ImpersonationAdminOrganizationOption[]>([])
  const targetUserId = createSignalObject("")
  const organizationId = createSignalObject("")
  const reason = createSignalObject("")
  const durationSeconds = createSignalObject(600)

  const fail = (result: FailedResult) => {
    error.set(result.errorMessage)
    status.set(impersonationAdminFailureStatusSelect(result))
  }

  const load = async () => {
    status.set("loading")
    error.set(undefined)
    notice.set(undefined)
    const current = await adapter.eligibilityGet()
    if (!current.success) return fail(current)
    eligibility.set(current.data)
    const [listed, organizationsListed, activeSession] = await Promise.all([
      adapter.userList(),
      adapter.organizationList(),
      adapter.activeGet(),
    ])
    if (!listed.success) return fail(listed)
    if (!organizationsListed.success) return fail(organizationsListed)
    if (!activeSession.success) return fail(activeSession)
    users.set(listed.data)
    organizations.set(organizationsListed.data)
    active.set(activeSession.data)
    const preselected = options.targetUserId?.()
    if (preselected !== undefined && preselected.length > 0) targetUserId.set(preselected)
    else if (targetUserId.get().length === 0) targetUserId.set(listed.data[0]?.id ?? "")
    if (options.endedSeed?.() === true) notice.set(messageTranslate("admin.impersonation.endedNotice"))
    // A nested attempt is narrated rather than rendered as a generic failure.
    if (current.data.nested) return status.set("nested-rejected")
    if (current.data.assurance !== "multi_factor" && !current.data.permitted) return status.set("assurance-required")
    status.set("ready")
  }

  const mutate = async <T>(id: string, operation: () => Promise<Result<T>>): Promise<T | undefined> => {
    pendingId.set(id)
    error.set(undefined)
    const result = await operation()
    pendingId.set(undefined)
    if (!result.success) {
      fail(result)
      return undefined
    }
    return result.data
  }

  createEffect(
    on(
      () => `${options.targetUserId?.() ?? ""}:${options.reloadKey?.() ?? ""}`,
      () => void load(),
    ),
  )

  return {
    active: active.get,
    durationSeconds,
    eligibility: eligibility.get,
    error: error.get,
    /** Deep link into the audit stream filtered to this impersonation session. */
    eventsHref: (basePath: string) => {
      const session = active.get()
      const query = session === null ? "impersonation" : session.sessionId
      return `${basePath}/events?q=${encodeURIComponent(query)}`
    },
    impersonationEnd: async () => {
      const session = active.get()
      if (session === null) return
      if (!options.confirm(messageTranslate("admin.impersonation.endConfirm", { subject: session.subjectLabel })))
        return
      const data = await mutate(`impersonation:end:${session.sessionId}`, () =>
        adapter.impersonationEnd(session.sessionId),
      )
      if (data === undefined) return
      active.set(null)
      status.set("ready")
      notice.set(messageTranslate("admin.impersonation.endedNotice"))
    },
    impersonationStart: async () => {
      validationMessage.set(undefined)
      const current = eligibility.get()
      if (current !== undefined && current.nested) {
        // Refused locally as well, so a nested attempt never reaches the server.
        validationMessage.set(messageTranslate("admin.impersonation.nestedRejected"))
        return
      }
      const subjectId = targetUserId.get()
      const trimmedReason = reason.get().trim()
      const subject = users.get().find((user) => user.id === subjectId)
      if (subject === undefined) {
        validationMessage.set(messageTranslate("admin.impersonation.targetRequired"))
        return
      }
      if (current !== undefined && subject.id === current.actorId) {
        validationMessage.set(messageTranslate("admin.impersonation.selfRejected"))
        return
      }
      if (trimmedReason.length < 3 || trimmedReason.length > 256) {
        validationMessage.set(messageTranslate("admin.impersonation.reasonRequired"))
        return
      }
      const duration = durationSeconds.get()
      if (
        !Number.isSafeInteger(duration) ||
        duration < impersonationAdminDurationBounds.minimumSeconds ||
        duration > impersonationAdminDurationBounds.maximumSeconds
      ) {
        validationMessage.set(messageTranslate("admin.impersonation.durationInvalid"))
        return
      }
      const organization = organizationId.get()
      if (
        !options.confirm(
          messageTranslate("admin.impersonation.startConfirm", {
            subject: impersonationAdminUserLabel(subject),
          }),
        )
      )
        return
      const data = await mutate("impersonation:start", () =>
        adapter.impersonationStart({
          durationSeconds: duration,
          ...(organization.length === 0 ? {} : { organizationId: organization }),
          reason: trimmedReason,
          targetUserId: subject.id,
        }),
      )
      if (data === undefined) return
      active.set(data)
      reason.set("")
      status.set("ready")
      notice.set(messageTranslate("admin.impersonation.startedNotice", { subject: data.subjectLabel }))
    },
    notice: notice.get,
    now: options.now,
    organizationId,
    organizations: organizations.get,
    pendingId: pendingId.get,
    reason,
    reload: () => void load(),
    /** Whole seconds left on the active impersonation, never negative. */
    remainingSeconds: () => {
      const session = active.get()
      if (session === null) return 0
      return Math.max(0, Math.floor((session.expiresAt - options.now()) / 1_000))
    },
    status: status.get,
    targetUserId,
    userLabel: impersonationAdminUserLabel,
    users: users.get,
    validationMessage: validationMessage.get,
  }
}

export type ImpersonationAdminPageState = ReturnType<typeof impersonationAdminPageStateCreate>

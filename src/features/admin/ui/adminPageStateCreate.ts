import { createEffect, on } from "solid-js"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { Event as TenantEvent } from "../../events/public/eventSchema.js"
import type { Realm } from "../../realms/public/realmSchema.js"
import type { RealmStatus } from "../../realms/public/realmStatusSchema.js"
import type { User } from "../../users/public/userSchema.js"
import type { UserState } from "../../users/public/userStateSchema.js"
import type { UserVerificationState } from "../../users/public/userVerificationStateSchema.js"
import type { AdminAdapter, AdminSession } from "./adminAdapter.js"
import type { AdminScreen } from "./adminScreenSchema.js"
import type { AdminUserSecurityAdapter } from "./adminUserSecurityAdapter.js"
import { adminUserSecurityStateCreate } from "./adminUserSecurityStateCreate.js"
import type { AdminViewStatus } from "./adminViewStatusSchema.js"

type FailedResult = { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }

type AdminPageStateOptions = {
  readonly adapter: AdminAdapter & AdminUserSecurityAdapter
  /**
   * Confirmation for every guarded action. It is answered by the shared in-app dialog rather
   * than a native prompt, so it may resolve asynchronously and the operator can always cancel.
   */
  readonly confirm: (message: string) => boolean | Promise<boolean>
  readonly initialStatus?: AdminViewStatus
  readonly pageSize?: number
  /** An extra reactive key that forces a reload, such as the selected demo fixture state. */
  readonly reloadKey?: () => string
  readonly screen: () => AdminScreen
  /** URL-held search term, so a filtered list survives reloads and deep links. */
  readonly search?: () => string
  readonly searchSet?: (value: string) => void
  readonly userId?: () => string | undefined
}

/** Owns every administration list, detail, mutation, and pagination behavior shared by both adapters. */
export function adminPageStateCreate(options: AdminPageStateOptions) {
  const pageSize = options.pageSize ?? 20
  const confirmAction = options.confirm
  const userSecurity = adminUserSecurityStateCreate({
    adapter: options.adapter,
    confirm: confirmAction,
    reloadKey: options.reloadKey,
    userId: () => options.userId?.(),
  })
  const status = createSignalObject<AdminViewStatus>(options.initialStatus ?? "loading")
  const error = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)
  const validationMessage = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const users = createSignalObject<readonly User[]>([])
  const user = createSignalObject<User | undefined>(undefined)
  const events = createSignalObject<readonly TenantEvent[]>([])
  const realm = createSignalObject<Realm | undefined>(undefined)
  const searchSignal = createSignalObject("")
  // Search lives in the URL when the caller provides it, and falls back to local state otherwise.
  const searchTerm = {
    get: () => options.search?.() ?? searchSignal.get(),
    set: (value: string) => (options.searchSet === undefined ? searchSignal.set(value) : options.searchSet(value)),
  }
  const expandedEventId = createSignalObject<string | undefined>(undefined)
  const pageTokens = createSignalObject<readonly string[]>([])
  const nextPageToken = createSignalObject<string | undefined>(undefined)
  const createOpen = createSignalObject(false)
  const createEmail = createSignalObject("")
  const createUserName = createSignalObject("")
  const createDisplayName = createSignalObject("")
  const realmName = createSignalObject("")
  const realmDomains = createSignalObject("")
  const realmStatus = createSignalObject<RealmStatus>("active")
  const session = createSignalObject<AdminSession | undefined>(undefined)
  const signInSecret = createSignalObject("")
  const lifecycleConfirmation = createSignalObject("")

  const fail = (result: FailedResult) => {
    error.set(result.errorMessage)
    if (result.code === "sessions.unauthorized") return status.set("expired")
    if (result.code === "realms.forbidden") return status.set("permission-denied")
    if (result.statusCode === 401) return status.set("expired")
    if (result.statusCode === 403) return status.set("permission-denied")
    status.set("error")
  }
  const realmApply = (next: Realm) => {
    realm.set(next)
    realmName.set(next.name)
    realmDomains.set(next.domains.join(", "))
    realmStatus.set(next.status)
  }
  const query = (): ListQuery => {
    const token = pageTokens.get().at(-1)
    return token === undefined ? { pageSize } : { pageSize, pageToken: token }
  }

  const load = async () => {
    status.set("loading")
    error.set(undefined)
    notice.set(undefined)
    if (options.screen() === "sign-in" || options.screen() === "sessions") {
      // An existing administrator session is shown when present, but the sign-in form must stay
      // reachable when there is none, so a failed probe is not an error.
      const current = await options.adapter.sessionCurrent()
      if (!current.success) {
        // The sign-in form must stay reachable without a session, but a fixture or backend
        // failure still has to surface so the operator sees why sign-in cannot proceed.
        if (current.code !== "sessions.unauthorized" && current.statusCode !== 401) error.set(current.errorMessage)
        return status.set("ready")
      }
      session.set(current.data)
      return status.set("signed-in")
    }
    if (options.screen() === "overview" || options.screen() === "realm") {
      const current = await options.adapter.sessionCurrent()
      if (!current.success) return fail(current)
      session.set(current.data)
      const result = await options.adapter.realmGet()
      if (!result.success) return fail(result)
      realmApply(result.data.realm)
      return status.set("ready")
    }
    if (options.screen() === "user-detail") {
      const userId = options.userId?.()
      if (userId === undefined || userId.length === 0) {
        error.set(messageTranslate("admin.users.missingId"))
        return status.set("error")
      }
      const result = await options.adapter.userGet(userId)
      if (!result.success) return fail(result)
      user.set(result.data.user)
      return status.set("ready")
    }
    if (options.screen() === "audit-events") {
      const result = await options.adapter.eventList(query())
      if (!result.success) return fail(result)
      events.set(result.data.items)
      nextPageToken.set(result.data.nextPageToken)
      return status.set(result.data.items.length === 0 ? "empty" : "ready")
    }
    const result = await options.adapter.userList(query())
    if (!result.success) return fail(result)
    users.set(result.data.items)
    nextPageToken.set(result.data.nextPageToken)
    status.set(result.data.items.length === 0 ? "empty" : "ready")
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
      () => `${options.screen()}:${options.userId?.() ?? ""}:${pageTokens.get().length}:${options.reloadKey?.() ?? ""}`,
      () => void load(),
    ),
  )

  return {
    adminSignInSubmit: async (event: SubmitEvent) => {
      event.preventDefault()
      validationMessage.set(undefined)
      error.set(undefined)
      const credential = signInSecret.get().trim()
      if (credential.length < 32) {
        validationMessage.set(messageTranslate("admin.signIn.credentialInvalid"))
        return
      }
      status.set("loading")
      const result = await options.adapter.adminSignIn(credential)
      // The credential is cleared immediately so it never survives the submission.
      signInSecret.set("")
      if (!result.success) return fail(result)
      session.set(result.data)
      status.set("signed-in")
    },
    adminSignOut: async () => {
      const confirmed = await confirmAction(messageTranslate("admin.signIn.signOutConfirm"))
      if (!confirmed) return
      const data = await mutate("session:sign-out", () => options.adapter.adminSignOut())
      if (data === undefined) return
      session.set(undefined)
      status.set("signed-out")
    },
    lifecycleConfirmation,
    realmLifecycleApply: async (next: RealmStatus) => {
      validationMessage.set(undefined)
      if (next === "disabled" && lifecycleConfirmation.get().trim() !== realm.get()?.name) {
        validationMessage.set(messageTranslate("admin.realm.confirmMismatch"))
        return
      }
      const data = await mutate(`realm:lifecycle:${next}`, () => options.adapter.realmUpdate({ status: next }))
      if (data === undefined) return
      realmApply(data.realm)
      lifecycleConfirmation.set("")
      notice.set(
        next === "disabled" ? messageTranslate("admin.realm.disabled") : messageTranslate("admin.realm.enabled"),
      )
    },
    session: session.get,
    signInSecret,
    createDisplayName,
    createEmail,
    createOpen,
    createUserName,
    error: error.get,
    events: () => {
      const term = searchTerm.get().trim().toLowerCase()
      if (term.length === 0) return events.get()
      return events
        .get()
        .filter((item) =>
          `${item.eventType} ${item.aggregateType} ${item.aggregateId} ${item.actorId ?? ""}`
            .toLowerCase()
            .includes(term),
        )
    },
    expandedEventId: expandedEventId.get,
    eventExpandToggle: (id: string) => expandedEventId.set(expandedEventId.get() === id ? undefined : id),
    hasNextPage: () => nextPageToken.get() !== undefined,
    hasPreviousPage: () => pageTokens.get().length > 0,
    notice: notice.get,
    pageNext: () => {
      const token = nextPageToken.get()
      if (token === undefined) return
      pageTokens.set([...pageTokens.get(), token])
    },
    pagePrevious: () => pageTokens.set(pageTokens.get().slice(0, -1)),
    pendingId: pendingId.get,
    realm: realm.get,
    realmDomains,
    realmName,
    realmSave: async (event: SubmitEvent) => {
      event.preventDefault()
      validationMessage.set(undefined)
      const name = realmName.get().trim()
      const domains = realmDomains
        .get()
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
      if (name.length === 0 || domains.length === 0) {
        validationMessage.set(messageTranslate("admin.realm.invalid"))
        return
      }
      if (realmStatus.get() === "disabled" && realm.get()?.status !== "disabled") {
        const confirmed = await confirmAction(messageTranslate("admin.realm.disableConfirm"))
        if (confirmed !== true) return
      }
      const data = await mutate("realm", () =>
        options.adapter.realmUpdate({ domain: domains[0], domains, name, status: realmStatus.get() }),
      )
      if (data === undefined) return
      realmApply(data.realm)
      notice.set(messageTranslate("admin.realm.saved"))
    },
    realmStatus,
    reload: () => void load(),
    searchTerm,
    status: status.get,
    user: user.get,
    userSecurity,
    userCreateSubmit: async (event: SubmitEvent) => {
      event.preventDefault()
      validationMessage.set(undefined)
      const email = createEmail.get().trim()
      const userName = createUserName.get().trim()
      const displayName = createDisplayName.get().trim()
      if (email.length < 3 || !email.includes("@") || userName.length === 0) {
        validationMessage.set(messageTranslate("admin.users.invalid"))
        return
      }
      const data = await mutate("user:create", () =>
        options.adapter.userCreate({
          email,
          profile: displayName.length === 0 ? {} : { displayName },
          userName,
        }),
      )
      if (data === undefined) return
      users.set([...users.get(), data.user])
      createEmail.set("")
      createUserName.set("")
      createDisplayName.set("")
      createOpen.set(false)
      status.set("ready")
      notice.set(messageTranslate("admin.users.created", { userName: data.user.userName }))
    },
    userDelete: async () => {
      const current = user.get()
      if (current === undefined) return
      const confirmed = await confirmAction(
        messageTranslate("admin.users.deleteConfirm", { userName: current.userName }),
      )
      if (confirmed !== true) return
      const data = await mutate(`user:delete:${current.id}`, () => options.adapter.userDelete(current.id))
      if (data === undefined) return
      user.set(data.user)
      status.set("deleted")
      notice.set(messageTranslate("admin.users.deleted", { userName: current.userName }))
    },
    userLifecycleSet: async (state: UserState) => {
      const current = user.get()
      if (current === undefined) return
      if (state === "locked" || state === "inactive" || state === "suspended") {
        const confirmed = await confirmAction(
          messageTranslate("admin.users.lifecycleConfirm", { state, userName: current.userName }),
        )
        if (confirmed !== true) return
      }
      const data = await mutate(`user:lifecycle:${current.id}`, () =>
        options.adapter.userLifecycleSet(current.id, { state }),
      )
      if (data === undefined) return
      user.set(data.user)
      notice.set(messageTranslate("admin.users.lifecycleChanged", { state: data.user.state }))
    },
    userProfileSave: async (input: {
      displayName: string
      firstName: string
      lastName: string
      nickName: string
      preferredLanguage: string
    }) => {
      const current = user.get()
      if (current === undefined) return
      validationMessage.set(undefined)
      if (input.displayName.trim().length === 0) {
        validationMessage.set(messageTranslate("admin.users.displayNameRequired"))
        return
      }
      const data = await mutate(`user:profile:${current.id}`, () =>
        options.adapter.userProfileUpdate(current.id, {
          displayName: input.displayName.trim(),
          firstName: input.firstName.trim() || null,
          lastName: input.lastName.trim() || null,
          nickName: input.nickName.trim() || null,
          preferredLanguage: input.preferredLanguage.trim() || null,
        }),
      )
      if (data === undefined) return
      user.set(data.user)
      notice.set(messageTranslate("admin.users.profileSaved"))
    },
    users: () => {
      const term = searchTerm.get().trim().toLowerCase()
      if (term.length === 0) return users.get()
      return users.get().filter((item) => `${item.userName} ${item.email} ${item.id}`.toLowerCase().includes(term))
    },
    userVerificationSet: async (state: UserVerificationState) => {
      const current = user.get()
      if (current === undefined) return
      const data = await mutate(`user:verification:${current.id}`, () =>
        options.adapter.userVerificationSet(current.id, { state }),
      )
      if (data === undefined) return
      user.set(data.user)
      notice.set(messageTranslate("admin.users.verificationChanged", { state: data.user.verificationState }))
    },
    validationMessage: validationMessage.get,
  }
}

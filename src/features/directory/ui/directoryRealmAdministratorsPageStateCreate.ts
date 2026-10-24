import { createEffect, on } from "solid-js"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { ConfirmRequest } from "../../../ui/confirm/confirmStateCreate.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { RealmAdministrator } from "../../realms/public/realmAdministratorSchema.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import type {
  DirectoryRealmAdministratorCandidate,
  DirectoryRealmAdministratorsAdapter,
} from "./directoryRealmAdministratorsAdapter.js"

export type DirectoryRealmAdministratorsStatus = "loading" | "ready" | "empty" | "error" | "permission-denied"

type FailedResult = { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }

const pageSize = 20

const cacheSchemaName = "authworks.admin.realmAdministrators"

/**
 * Adapter-agnostic state for the realm administrators page: the administrator list,
 * the server-guarded last-administrator case, and the grant-picker user search.
 * Views read only from here, so production and demo render identically.
 */
export function directoryRealmAdministratorsPageStateCreate(options: {
  readonly adapter: DirectoryRealmAdministratorsAdapter
  readonly cacheKey: () => string
  readonly confirm: (request: ConfirmRequest) => boolean | Promise<boolean>
  readonly realmId: string
  /** Reactive key forcing a reload, such as the selected demo fixture state. */
  readonly reloadKey?: () => string
  readonly search: () => string
}) {
  const adapter = options.adapter
  const status = createSignalObject<DirectoryRealmAdministratorsStatus>("loading")
  const searchStatus = createSignalObject<"idle" | "loading" | "ready" | "empty" | "error">("idle")
  const error = createSignalObject<string | undefined>(undefined)
  const searchError = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)
  const danger = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const administrators = createSignalObject<readonly RealmAdministrator[]>([])
  const candidates = createSignalObject<readonly DirectoryRealmAdministratorCandidate[]>([])

  const cacheRead = (): readonly RealmAdministrator[] | undefined => {
    try {
      if (typeof localStorage === "undefined") return undefined
      const raw = localStorage.getItem(options.cacheKey())
      if (raw === null) return undefined
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return undefined
      return parsed as readonly RealmAdministrator[]
    } catch {
      return undefined
    }
  }
  const cacheWrite = (entries: readonly RealmAdministrator[]): void => {
    try {
      if (typeof localStorage === "undefined") return
      localStorage.setItem(options.cacheKey(), JSON.stringify([...entries]))
    } catch {
      // A blocked storage partition must not break the screen; the list simply reloads.
    }
  }

  const fail = (result: FailedResult) => {
    if (result.code === "realms.administrator-last") {
      danger.set(messageTranslate("admin.realmAdministrators.lastAdminHint"))
      return status.set("ready")
    }
    error.set(result.errorMessage)
    if (result.statusCode === 401 || result.statusCode === 403) return status.set("permission-denied")
    status.set("error")
  }
  const confirmed = async (request: ConfirmRequest) => (await options.confirm(request)) === true

  const load = async () => {
    status.set("loading")
    error.set(undefined)
    danger.set(undefined)
    notice.set(undefined)
    if (options.realmId.length === 0) {
      error.set(messageTranslate("admin.common.permission"))
      return status.set("permission-denied")
    }
    const listed = await adapter.administratorList()
    if (!listed.success) return fail(listed)
    administrators.set([...listed.data])
    cacheWrite(listed.data)
    status.set(listed.data.length === 0 ? "empty" : "ready")
  }

  const candidateBuild = (entry: DirectoryEntry): DirectoryRealmAdministratorCandidate => ({
    alreadyAdmin: administrators.get().some((admin) => admin.userId === entry.user.id),
    displayName: entry.user.displayName ?? entry.user.userName,
    email: entry.user.email,
    userId: entry.user.id,
    userName: entry.user.userName,
  })

  const candidateSearch = async (search: string) => {
    const trimmed = search.trim()
    if (trimmed.length === 0) {
      candidates.set([])
      searchStatus.set("idle")
      return
    }
    searchStatus.set("loading")
    searchError.set(undefined)
    const found = await adapter.realmUserSearch(trimmed)
    if (!found.success) {
      searchError.set(found.errorMessage)
      searchStatus.set("error")
      return
    }
    const limited = found.data.slice(0, pageSize).map(candidateBuild)
    candidates.set(limited)
    searchStatus.set(limited.length === 0 ? "empty" : "ready")
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

  const administratorRemove = async (administrator: RealmAdministrator) => {
    danger.set(undefined)
    notice.set(undefined)
    if (
      !(await confirmed({
        acceptLabel: messageTranslate("admin.realmAdministrators.confirmRemoveAccept"),
        message: messageTranslate("admin.realmAdministrators.confirmRemoveMessage", {
          name: administrator.user.displayName ?? administrator.user.userName,
        }),
        title: messageTranslate("admin.realmAdministrators.confirmRemoveTitle"),
      }))
    )
      return
    const removed = await mutate(`revoke:${administrator.userId}`, () =>
      adapter.administratorRevoke(administrator.userId),
    )
    if (removed === undefined) {
      // The server guards the last administrator with `realms.administrator-last`, which the
      // page surfaces as a sticky notice instead of a generic error state.
      if (danger.get() !== undefined) return
      notice.set(messageTranslate("admin.realmAdministrators.revokeFailed"))
      return
    }
    administrators.set(administrators.get().filter((entry) => entry.userId !== removed.userId))
    notice.set(
      messageTranslate("admin.realmAdministrators.removed", {
        name: administrator.user.displayName ?? administrator.user.userName,
      }),
    )
  }

  const administratorGrant = async (candidate: DirectoryRealmAdministratorCandidate) => {
    danger.set(undefined)
    notice.set(undefined)
    if (candidate.alreadyAdmin) return false
    const created = await mutate(`grant:${candidate.userId}`, () => adapter.administratorGrant(candidate.userId))
    if (created === undefined) return false
    const next = [...administrators.get(), created.administrator].sort((left, right) =>
      (left.user.displayName ?? left.user.userName).localeCompare(right.user.displayName ?? right.user.userName),
    )
    administrators.set(next)
    cacheWrite(next)
    status.set("ready")
    notice.set(messageTranslate("admin.realmAdministrators.added", { name: candidate.displayName }))
    candidates.set(
      candidates.get().map((entry) => (entry.userId === candidate.userId ? { ...entry, alreadyAdmin: true } : entry)),
    )
    return true
  }

  const cached = cacheRead()
  if (cached !== undefined && cached.length > 0) {
    administrators.set(cached)
    status.set("ready")
  }

  createEffect(
    on(
      () => `${options.realmId}:${options.reloadKey?.() ?? ""}`,
      () => {
        void load()
      },
    ),
  )

  return {
    administrators: administrators.get,
    administratorGrant,
    administratorRemove,
    cacheKey: () => cacheSchemaName,
    candidates: candidates.get,
    candidateSearch,
    danger: danger.get,
    error: error.get,
    lastAdmin: () => administrators.get().length === 1,
    notice: notice.get,
    pendingId: pendingId.get,
    reload: () => void load(),
    searchError: searchError.get,
    searchStatus: searchStatus.get,
    status: status.get,
  }
}

export type DirectoryRealmAdministratorsPageState = ReturnType<typeof directoryRealmAdministratorsPageStateCreate>

import { createEffect, on } from "solid-js"
import * as v from "valibot"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { MachineUserCreateRequest } from "../../machineUsers/public/machineUserCreateRequestSchema.js"
import type { MachineUser } from "../../machineUsers/public/machineUserSchema.js"
import { machineAdminScopeListParse } from "../../machineUsers/ui/machineAdminScopeListParse.js"
import type { OrganizationInvitation } from "../../organizations/public/organizationInvitationSchema.js"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"
import type { UserCreateRequest } from "../../users/public/userCreateRequestSchema.js"
import type { User } from "../../users/public/userSchema.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import { directoryEntrySchema } from "../public/directoryEntrySchema.js"
import type { DirectoryOrganizationUserSummary } from "../public/directoryOrganizationUserSummarySchema.js"
import type { DirectoryUserListQuery } from "../public/directoryUserListSchema.js"
import type { DirectoryAdminAdapter, DirectoryAdminServiceAccountIssue } from "./directoryAdminAdapter.js"
import type { DirectoryAdminScope } from "./directoryAdminScopeSchema.js"
import type { DirectoryAdminTab } from "./directoryAdminTabSchema.js"
import { directoryAdminUsersQueryParse } from "./directoryAdminUsersQuerySchema.js"

type FailedResult = { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }

export type DirectoryAdminUsersStatus =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "permission-denied"
  | "assurance-required"

/** Maps a coded API failure onto the status the users page presents. */
export function directoryAdminUsersFailureStatusSelect(failure: FailedResult): DirectoryAdminUsersStatus {
  if (failure.code === "sessions.assurance-required" || failure.code === "organizations.assurance-required")
    return "assurance-required"
  if (failure.code === "organizations.forbidden" || failure.statusCode === 401 || failure.statusCode === 403)
    return "permission-denied"
  return "error"
}

export type { DirectoryAdminScope } from "./directoryAdminScopeSchema.js"

export type DirectoryAdminUsersPageStateCreateOptions = {
  readonly adapter: DirectoryAdminAdapter
  /** Renders in-app destructive confirmations; without one the revoke guard declines. */
  readonly confirm: (message: string) => boolean | Promise<boolean>
  readonly realmId: string
  readonly organizationId: string
  readonly realmAdministrator: boolean
  /** Reactive key forcing a reload, such as the selected demo fixture state. */
  readonly reloadKey?: () => string
  readonly search: () => string
  /** Kept in memory only: the one-time invitation token is shown once after creation. */
  readonly invitationTokenSeed?: () => string | undefined
  readonly onInvitationTokenAcknowledge?: () => void
}

const pageSize = 20

const cacheSchemaName = "authworks.admin.users"
const cacheEntrySchemaVersion = 1

const cacheRead = (key: string): DirectoryEntry[] | undefined => {
  try {
    if (typeof localStorage === "undefined") return undefined
    const raw = localStorage.getItem(key)
    if (raw === null) return undefined
    const parsed: unknown = JSON.parse(raw)
    const validated = v.safeParse(
      v.strictObject({
        entries: v.array(directoryEntrySchema),
        version: v.literal(cacheEntrySchemaVersion),
      }),
      parsed,
    )
    if (!validated.success) return undefined
    return [...validated.output.entries]
  } catch {
    return undefined
  }
}

const cacheWrite = (key: string, entries: readonly DirectoryEntry[]): void => {
  try {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(key, JSON.stringify({ entries: [...entries], version: cacheEntrySchemaVersion }))
  } catch {
    // A blocked storage partition must not break the screen; the list simply reloads.
  }
}

/**
 * Shared, adapter-agnostic state for the users page: people search/sort/filter, service
 * accounts, pending invitations, and the invite/create dialogs. Views read only from here,
 * so production and demo render identically.
 */
export function directoryAdminUsersPageStateCreate(options: DirectoryAdminUsersPageStateCreateOptions) {
  const adapter = options.adapter
  const status = createSignalObject<DirectoryAdminUsersStatus>("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)
  const validationMessage = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const people = createSignalObject<readonly DirectoryEntry[]>([])
  const summary = createSignalObject<DirectoryOrganizationUserSummary | undefined>(undefined)
  const serviceAccounts = createSignalObject<readonly MachineUser[]>([])
  const invitations = createSignalObject<readonly OrganizationInvitation[]>([])
  const invitationToken = createSignalObject<string | undefined>(options.invitationTokenSeed?.())
  const serviceSecret = createSignalObject<DirectoryAdminServiceAccountIssue | undefined>(undefined)
  const createdUser = createSignalObject<User | undefined>(undefined)
  const nextPageToken = createSignalObject<string | undefined>(undefined)
  const serviceNextPageToken = createSignalObject<string | undefined>(undefined)
  const invitationNextPageToken = createSignalObject<string | undefined>(undefined)
  const pageTokens = createSignalObject<readonly string[]>([])
  const servicePageTokens = createSignalObject<readonly string[]>([])
  const invitationPageTokens = createSignalObject<readonly string[]>([])

  const query = () => directoryAdminUsersQueryParse(options.search())
  const tab = (): DirectoryAdminTab => query().tab ?? "people"
  const scope = (): DirectoryAdminScope => {
    if (!options.realmAdministrator) return "organization"
    return query().scope ?? "organization"
  }
  const cacheKey = () => `${cacheSchemaName}.${options.realmId}.${options.organizationId}.${scope()}`

  const fail = (result: FailedResult) => {
    error.set(result.errorMessage)
    status.set(directoryAdminUsersFailureStatusSelect(result))
  }
  const confirmed = async (message: string) => (await options.confirm(message)) === true

  const peopleQuery = (): DirectoryUserListQuery => {
    const parsed = query()
    return {
      pageSize,
      ...(pageTokens.get().at(-1) === undefined ? {} : { pageToken: pageTokens.get().at(-1) as string }),
      ...(parsed.q !== undefined && parsed.q.length > 0 ? { search: parsed.q } : {}),
      ...(parsed.role !== undefined ? { role: parsed.role } : {}),
      sortBy: parsed.sort ?? "lastSignInAt",
      sortDirection: parsed.dir ?? (parsed.sort === "userName" ? "asc" : "desc"),
    }
  }

  const load = async () => {
    status.set("loading")
    error.set(undefined)
    notice.set(undefined)
    if (options.realmId.length === 0 || options.organizationId.length === 0) {
      error.set(messageTranslate("admin.common.permission"))
      return status.set("permission-denied")
    }
    const activeTab = tab()
    if (activeTab === "service-accounts") {
      const pageToken = servicePageTokens.get().at(-1)
      const listed = await adapter.serviceAccountList(pageToken === undefined ? undefined : { pageSize, pageToken })
      if (!listed.success) return fail(listed)
      serviceAccounts.set([...listed.data.items])
      serviceNextPageToken.set(listed.data.nextPageToken)
      return status.set(listed.data.items.length === 0 ? "empty" : "ready")
    }
    if (activeTab === "invitations") {
      const pageToken = invitationPageTokens.get().at(-1)
      const listed = await adapter.invitationList(pageToken === undefined ? undefined : { pageSize, pageToken })
      if (!listed.success) return fail(listed)
      invitations.set([...listed.data.items])
      invitationNextPageToken.set(listed.data.nextPageToken)
      return status.set(listed.data.items.length === 0 ? "empty" : "ready")
    }
    const current = scope()
    const [listed, summaryResult] =
      current === "all"
        ? await Promise.all([adapter.realmUserList(peopleQuery()), adapter.organizationUserSummary()])
        : await Promise.all([adapter.organizationUserList(peopleQuery()), adapter.organizationUserSummary()])
    if (!listed.success) return fail(listed)
    if (!summaryResult.success) return fail(summaryResult)
    people.set([...listed.data.items])
    summary.set(summaryResult.data)
    nextPageToken.set(listed.data.nextPageToken)
    cacheWrite(cacheKey(), listed.data.items)
    return status.set(listed.data.items.length === 0 ? "empty" : "ready")
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

  const cached = cacheRead(cacheKey())
  if (cached !== undefined && cached.length > 0) {
    people.set(cached)
    status.set("ready")
  }

  createEffect(
    on(
      () =>
        `${tab()}:${scope()}:${query().q ?? ""}:${query().role ?? ""}:${query().sort ?? ""}:${query().dir ?? ""}:${pageTokens.get().length}:${options.realmId}:${options.organizationId}:${options.reloadKey?.() ?? ""}`,
      () => {
        void load()
      },
    ),
  )

  return {
    createdUser: createdUser.get,
    error: error.get,
    invitationCreateSubmit: async (input: { email: string; roles: readonly OrganizationRoleId[] }) => {
      validationMessage.set(undefined)
      const email = input.email.trim()
      if (email.length < 3 || !email.includes("@")) {
        validationMessage.set(messageTranslate("admin.users.inviteEmailInvalid"))
        return
      }
      if (input.roles.length === 0) {
        validationMessage.set(messageTranslate("admin.users.inviteRolesInvalid"))
        return
      }
      const created = await mutate("invitation:create", () =>
        adapter.invitationCreate({ email, roles: [...input.roles] }),
      )
      if (created === undefined) return
      invitationToken.set(created.token)
      notice.set(messageTranslate("admin.users.inviteSent"))
      await load()
    },
    invitationRevoke: async (invitationId: string, email: string) => {
      if (!(await confirmed(messageTranslate("admin.users.inviteRevokeConfirm", { email })))) return
      const revoked = await mutate(`invitation:${invitationId}`, () => adapter.invitationRevoke(invitationId))
      if (revoked === undefined) return
      notice.set(messageTranslate("admin.users.inviteRevoked"))
      await load()
    },
    invitations: invitations.get,
    invitationToken: invitationToken.get,
    invitationTokenAcknowledge: () => {
      options.onInvitationTokenAcknowledge?.()
      invitationToken.set(undefined)
    },
    notice: notice.get,
    nextPageAvailable: () => nextPageToken.get() !== undefined,
    pageNext: () => {
      const token = nextPageToken.get()
      if (token === undefined) return
      pageTokens.set([...pageTokens.get(), token])
    },
    pagePrevious: () => pageTokens.set(pageTokens.get().slice(0, -1)),
    pendingId: pendingId.get,
    people: people.get,
    peopleQuery,
    previousPageAvailable: () => pageTokens.get().length > 0,
    realmAdministrator: () => options.realmAdministrator,
    reload: () => void load(),
    scope,
    serviceAccountCreateSubmit: async (input: { displayName: string; scopes: string; userName: string }) => {
      validationMessage.set(undefined)
      const displayName = input.displayName.trim()
      const userName = input.userName.trim()
      if (displayName.length === 0 || userName.length === 0) {
        validationMessage.set(messageTranslate("admin.users.serviceAccountInvalid"))
        return false
      }
      const scopes = machineAdminScopeListParse(input.scopes)
      const request: MachineUserCreateRequest = {
        displayName,
        ...(scopes.length === 0 ? {} : { scopes: [...scopes] }),
        userName,
      }
      const created = await mutate("service-account:create", () => adapter.serviceAccountCreate(request))
      if (created === undefined) return false
      serviceAccounts.set([...serviceAccounts.get(), created.machineUser])
      status.set("ready")
      notice.set(messageTranslate("admin.users.serviceAccountCreated"))
      serviceSecret.set(created)
      return true
    },
    serviceAccounts: serviceAccounts.get,
    serviceNextPageAvailable: () => serviceNextPageToken.get() !== undefined,
    servicePageNext: () => {
      const token = serviceNextPageToken.get()
      if (token === undefined) return
      servicePageTokens.set([...servicePageTokens.get(), token])
    },
    servicePagePrevious: () => servicePageTokens.set(servicePageTokens.get().slice(0, -1)),
    servicePreviousPageAvailable: () => servicePageTokens.get().length > 0,
    serviceSecret: serviceSecret.get,
    serviceSecretAcknowledge: () => serviceSecret.set(undefined),
    status: status.get,
    summary: summary.get,
    tab,
    userCreateSubmit: async (input: UserCreateRequest) => {
      validationMessage.set(undefined)
      const email = input.email.trim()
      const userName = input.userName.trim()
      const displayName = input.profile.displayName?.trim() ?? ""
      const firstName = input.profile.firstName?.trim() ?? ""
      const lastName = input.profile.lastName?.trim() ?? ""
      if (email.length < 3 || !email.includes("@") || userName.length === 0) {
        validationMessage.set(messageTranslate("admin.users.invalid"))
        return
      }
      const created = await mutate("user:create", () =>
        adapter.directoryUserCreate({
          email,
          profile: {
            ...(displayName.length === 0 ? {} : { displayName }),
            ...(firstName.length === 0 ? {} : { firstName }),
            ...(lastName.length === 0 ? {} : { lastName }),
          },
          userName,
        }),
      )
      if (created === undefined) return
      createdUser.set(created.user)
      notice.set(messageTranslate("admin.users.created", { userName: created.user.userName }))
      await load()
    },
    validationMessage: validationMessage.get,
  }
}

export type DirectoryAdminUsersPageState = ReturnType<typeof directoryAdminUsersPageStateCreate>

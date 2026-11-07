import { createEffect, on } from "solid-js"
import * as v from "valibot"
import type { Result } from "#result"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { Team } from "../../teams/public/teamSchema.js"
import { teamSlugSchema } from "../../teams/public/teamSlugSchema.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import type { DirectoryUserListQuery } from "../public/directoryUserListSchema.js"
import { directoryAdminUsersQueryParse } from "./directoryAdminUsersQuerySchema.js"
import type { DirectoryTeamsAdapter } from "./directoryTeamsAdapter.js"

type FailedResult = { readonly code?: string; readonly errorMessage: string; readonly statusCode?: number }

export type DirectoryTeamsStatus = "loading" | "ready" | "error" | "permission-denied"

/** Maps a coded teams API failure onto the status the Teams tab presents. */
export function directoryTeamsFailureStatusSelect(failure: FailedResult): DirectoryTeamsStatus {
  if (failure.code === "organizations.forbidden" || failure.code === "teams.forbidden" || failure.statusCode === 403)
    return "permission-denied"
  if (failure.statusCode === 401) return "permission-denied"
  return "error"
}

export type DirectoryTeamsPageStateCreateOptions = {
  readonly actorUserId: () => string | undefined
  readonly adapter: DirectoryTeamsAdapter
  /** Renders in-app destructive confirmations; without one the remove/delete guard declines. */
  readonly canManageAll: () => boolean
  /** Renders in-app destructive confirmations; without one destructive actions decline. */
  readonly confirm: (message: string) => boolean | Promise<boolean>
  /** Called once when a leader-scoped actor has no team selected, so the view defaults the URL. */
  readonly leaderDefaultTeamSelect?: (slug: string) => void
  /** Reactive tenant context; the list reloads when the active realm or organization changes. */
  readonly organizationId: () => string
  readonly realmId: () => string
  /** Reactive key forcing a reload, such as the selected demo fixture state. */
  readonly reloadKey?: () => string
  readonly search: () => string
}

const pageSize = 20

const teamFailureMessage = (failure: FailedResult): string => {
  if (failure.code === "teams.slug-conflict") return messageTranslate("admin.teams.slugConflict")
  if (failure.code === "teams.name-conflict") return messageTranslate("admin.teams.nameConflict")
  if (failure.code === "teams.leader-conflict") return messageTranslate("admin.teams.leaderConflict")
  return failure.errorMessage
}

/**
 * Adapter-agnostic state for the Teams tab: the team list, the slug-selected
 * detail, member search, and every teams mutation the view offers. Views read
 * only from here, so production and demo render identically.
 */
export function directoryTeamsPageStateCreate(options: DirectoryTeamsPageStateCreateOptions) {
  const adapter = options.adapter
  const status = createSignalObject<DirectoryTeamsStatus>("loading")
  const error = createSignalObject<string | undefined>(undefined)
  const notice = createSignalObject<string | undefined>(undefined)
  const validationMessage = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const teams = createSignalObject<readonly Team[]>([])
  const unassignedCount = createSignalObject(0)
  const members = createSignalObject<readonly DirectoryEntry[]>([])
  const memberNextPageToken = createSignalObject<string | undefined>(undefined)
  const membersError = createSignalObject<string | undefined>(undefined)
  const memberPageTokens = createSignalObject<readonly string[]>([])
  const pickerResults = createSignalObject<readonly DirectoryEntry[]>([])

  const query = () => directoryAdminUsersQueryParse(options.search())
  const selectedSlug = (): string | undefined => query().team
  const activeTab = () => query().tab ?? "people"

  let lastFailureCode: string | undefined
  const fail = (result: FailedResult) => {
    lastFailureCode = result.code
    error.set(result.errorMessage)
    status.set(directoryTeamsFailureStatusSelect(result))
  }

  const confirmed = async (message: string) => (await options.confirm(message)) === true

  const mutate = async <T>(id: string, operation: () => Promise<Result<T>>): Promise<T | undefined> => {
    const requestRealmId = options.realmId()
    const requestOrganizationId = options.organizationId()
    pendingId.set(id)
    error.set(undefined)
    const result = await operation()
    pendingId.set(undefined)
    if (requestRealmId !== options.realmId() || requestOrganizationId !== options.organizationId()) return undefined
    if (!result.success) {
      fail(result)
      return undefined
    }
    return result.data
  }

  const teamBySlug = (slug: string): Team | undefined => teams.get().find((team) => team.slug === slug)

  const ledTeams = (): readonly Team[] => {
    const actor = options.actorUserId()
    if (actor === undefined) return []
    return teams.get().filter((team) => team.leader.userId === actor)
  }

  const isLeaderScope = (): boolean => !options.canManageAll() && ledTeams().length > 0

  const teamLeadershipOfGet = (userId: string): Team | undefined =>
    teams.get().find((team) => team.leader.userId === userId)

  const teamSlugError = (slug: string): string | undefined => {
    if (slug.length === 0) return messageTranslate("admin.teams.slugInvalid")
    if (slug === "unassigned") return messageTranslate("admin.teams.slugReserved")
    if (!v.safeParse(teamSlugSchema, slug).success) return messageTranslate("admin.teams.slugInvalid")
    return undefined
  }

  let requestSequence = 0
  const requestNext = () => {
    requestSequence += 1
    return requestSequence
  }
  const requestCurrent = (requestId: number, realmId: string, organizationId: string): boolean =>
    requestId === requestSequence && realmId === options.realmId() && organizationId === options.organizationId()

  const teamsLoad = async () => {
    const requestId = requestNext()
    const requestRealmId = options.realmId()
    const requestOrganizationId = options.organizationId()
    status.set("loading")
    error.set(undefined)
    if (requestRealmId.length === 0 || requestOrganizationId.length === 0) {
      error.set(messageTranslate("admin.common.permission"))
      return status.set("permission-denied")
    }
    const listed = await adapter.teamList()
    if (!requestCurrent(requestId, requestRealmId, requestOrganizationId)) return
    if (!listed.success) return fail(listed)
    teams.set([...listed.data.items])
    unassignedCount.set(listed.data.unassignedCount ?? 0)
    status.set("ready")
    // A leader-scoped actor with no team selected defaults to their own team slug. This
    // runs here (not only in the URL effect) because teams arrive after the first effect run.
    if (selectedSlug() === undefined && isLeaderScope() && options.leaderDefaultTeamSelect !== undefined) {
      const fallback = ledTeams()[0]?.slug
      const notifyKey = `${requestRealmId}:${requestOrganizationId}:${fallback ?? ""}`
      if (fallback !== undefined && lastDefaultNotified !== notifyKey) {
        lastDefaultNotified = notifyKey
        options.leaderDefaultTeamSelect(fallback)
      }
    }
  }

  const memberQuery = (): DirectoryUserListQuery => {
    const slug = selectedSlug()
    return {
      pageSize,
      ...(memberPageTokens.get().at(-1) === undefined ? {} : { pageToken: memberPageTokens.get().at(-1) as string }),
      ...(slug === undefined ? {} : { team: slug }),
    }
  }

  const membersLoad = async () => {
    const requestId = requestNext()
    const requestRealmId = options.realmId()
    const requestOrganizationId = options.organizationId()
    const slug = selectedSlug()
    if (slug === undefined) {
      members.set([])
      memberNextPageToken.set(undefined)
      return
    }
    const listed = await adapter.organizationUserList(memberQuery())
    if (!requestCurrent(requestId, requestRealmId, requestOrganizationId)) return
    if (slug !== selectedSlug()) return
    if (!listed.success) {
      members.set([])
      memberNextPageToken.set(undefined)
      membersError.set(listed.errorMessage)
      return
    }
    members.set([...listed.data.items])
    memberNextPageToken.set(listed.data.nextPageToken)
    membersError.set(undefined)
  }

  let lastEffectKey: string | undefined
  let lastContextKey = `${options.realmId()}:${options.organizationId()}`
  let lastDefaultNotified: string | undefined
  const effectKeyGet = () =>
    `${activeTab()}:${selectedSlug() ?? ""}:${memberPageTokens.get().length}:${options.realmId()}:${options.organizationId()}:${options.reloadKey?.() ?? ""}`

  createEffect(
    on(effectKeyGet, (effectKey) => {
      if (effectKey === lastEffectKey) return
      lastEffectKey = effectKey
      const nextContextKey = `${options.realmId()}:${options.organizationId()}`
      if (nextContextKey !== lastContextKey) {
        lastContextKey = nextContextKey
        lastDefaultNotified = undefined
        teams.set([])
        members.set([])
        memberPageTokens.set([])
        memberNextPageToken.set(undefined)
        unassignedCount.set(0)
        lastEffectKey = effectKeyGet()
        void teamsLoad().then(() => void membersLoad())
        return
      }
      if (activeTab() === "service-accounts") return
      // Snapshot the slug: the default-selection callback rewrites the URL
      // synchronously inside teamsLoad, so reading it live here would see the
      // new slug and fire a stray membersLoad that invalidates the rerun's
      // teamsLoad request guard, sticking the tab in loading.
      const slugAtEffectStart = selectedSlug()
      void teamsLoad().then(() => {
        // The default-selection callback rewrites the URL, which reruns this effect.
        if (slugAtEffectStart === undefined && isLeaderScope()) return
        void membersLoad()
      })
    }),
  )

  return {
    activeTab,
    canManageAll: () => options.canManageAll(),
    error: error.get,
    isLeaderScope,
    ledTeams,
    memberNextPageAvailable: () => memberNextPageToken.get() !== undefined,
    memberPageNext: () => {
      const token = memberNextPageToken.get()
      if (token === undefined) return
      memberPageTokens.set([...memberPageTokens.get(), token])
    },
    memberPagePrevious: () => memberPageTokens.set(memberPageTokens.get().slice(0, -1)),
    memberPreviousPageAvailable: () => memberPageTokens.get().length > 0,
    memberQuery,
    members: members.get,
    membersError: membersError.get,
    membersReload: () => void membersLoad(),
    notice: notice.get,
    noticeClear: () => notice.set(undefined),
    organizationId: () => options.organizationId(),
    pendingId: pendingId.get,
    pickerResults: pickerResults.get,
    memberCandidateSearch: async (search: string) => {
      const trimmed = search.trim()
      // Leader-scoped actors may only add people who are currently unassigned,
      // so their picker sources the unassigned list; admins keep full search.
      const leaderScoped = !options.canManageAll() && ledTeams().length > 0
      const found = await adapter.organizationUserList(
        leaderScoped
          ? { pageSize, team: "unassigned", ...(trimmed.length === 0 ? {} : { search: trimmed }) }
          : trimmed.length === 0
            ? { pageSize }
            : { pageSize, search: trimmed },
      )
      if (!found.success) {
        error.set(found.errorMessage)
        return
      }
      pickerResults.set([...found.data.items])
    },
    pickerResultsClear: () => pickerResults.set([]),
    selectedSlug,
    selectedTeam: (): Team | undefined => {
      const slug = selectedSlug()
      return slug === undefined || slug === "unassigned" ? undefined : teamBySlug(slug)
    },
    status: status.get,
    teamBySlug,
    teamCreateSubmit: async (input: { leaderUserId: string; name: string; slug: string }) => {
      validationMessage.set(undefined)
      const name = input.name.trim()
      if (name.length === 0) {
        validationMessage.set(messageTranslate("admin.teams.nameRequired"))
        return undefined
      }
      const slugError = teamSlugError(input.slug)
      if (slugError !== undefined) {
        validationMessage.set(slugError)
        return undefined
      }
      if (input.leaderUserId.length === 0) {
        validationMessage.set(messageTranslate("admin.teams.leaderRequired"))
        return undefined
      }
      const created = await mutate("team:create", () =>
        adapter.teamCreate({ leaderUserId: input.leaderUserId, name, slug: input.slug }),
      )
      if (created === undefined) {
        validationMessage.set(teamFailureMessage({ code: lastFailureCode, errorMessage: error.get() ?? "" }))
        return undefined
      }
      notice.set(messageTranslate("admin.teams.created", { name: created.team.name }))
      await teamsLoad()
      return created.team
    },
    teamDeleteSubmit: async (team: Team) => {
      validationMessage.set(undefined)
      const accepted = await confirmed(
        `${messageTranslate("admin.teams.deleteConfirm", { name: team.name })} ${messageTranslate("admin.teams.deleteConfirmDetail")}`,
      )
      if (!accepted) return false
      const deleted = await mutate(`team:delete:${team.id}`, () => adapter.teamDelete(team.slug))
      if (deleted === undefined) {
        validationMessage.set(error.get() ?? messageTranslate("common.error"))
        return false
      }
      notice.set(messageTranslate("admin.teams.deleted", { name: team.name }))
      await teamsLoad()
      return true
    },
    teamLeadershipOfGet,
    teamMemberAssignSubmit: async (team: Team, userId: string, displayName: string) => {
      validationMessage.set(undefined)
      const assigned = await mutate(`team:assign:${team.id}:${userId}`, () =>
        adapter.teamMemberAssign(team.slug, { userId }),
      )
      if (assigned === undefined) {
        validationMessage.set(teamFailureMessage({ code: lastFailureCode, errorMessage: error.get() ?? "" }))
        return false
      }
      notice.set(messageTranslate("admin.teams.assigned", { name: displayName, team: assigned.team.name }))
      await teamsLoad()
      await membersLoad()
      return true
    },
    teamMemberUnassignSubmit: async (team: Team, userId: string, displayName: string) => {
      validationMessage.set(undefined)
      if (team.leader.userId === userId) {
        validationMessage.set(messageTranslate("admin.teams.removeLeaderDenied"))
        return false
      }
      const accepted = await confirmed(
        messageTranslate("admin.teams.removeMemberConfirm", { name: displayName, team: team.name }),
      )
      if (!accepted) return false
      const unassigned = await mutate(`team:unassign:${team.id}:${userId}`, () =>
        adapter.teamMemberUnassign(team.slug, userId),
      )
      if (unassigned === undefined) {
        const message =
          lastFailureCode === "teams.leader-conflict"
            ? messageTranslate("admin.teams.removeLeaderDenied")
            : (error.get() ?? messageTranslate("common.error"))
        validationMessage.set(message)
        return false
      }
      notice.set(messageTranslate("admin.teams.removedMember", { name: displayName }))
      await teamsLoad()
      await membersLoad()
      return true
    },
    teamSlugError,
    teamUpdateSubmit: async (team: Team, input: { leaderUserId?: string; name?: string; slug?: string }) => {
      validationMessage.set(undefined)
      const name = input.name === undefined ? undefined : input.name.trim()
      if (name !== undefined && name.length === 0) {
        validationMessage.set(messageTranslate("admin.teams.nameRequired"))
        return undefined
      }
      if (input.slug !== undefined) {
        const slugError = teamSlugError(input.slug)
        if (slugError !== undefined) {
          validationMessage.set(slugError)
          return undefined
        }
      }
      const updated = await mutate(`team:update:${team.id}`, () =>
        adapter.teamUpdate(team.slug, {
          ...(input.leaderUserId === undefined ? {} : { leaderUserId: input.leaderUserId }),
          ...(name === undefined ? {} : { name }),
          ...(input.slug === undefined ? {} : { slug: input.slug }),
        }),
      )
      if (updated === undefined) {
        validationMessage.set(teamFailureMessage({ code: lastFailureCode, errorMessage: error.get() ?? "" }))
        return undefined
      }
      notice.set(messageTranslate("admin.teams.updated", { name: updated.team.name }))
      await teamsLoad()
      return updated.team
    },
    teams: teams.get,
    teamsReload: () => void teamsLoad(),
    unassignedCount: unassignedCount.get,
    validationMessage: validationMessage.get,
  }
}

export type DirectoryTeamsPageState = ReturnType<typeof directoryTeamsPageStateCreate>

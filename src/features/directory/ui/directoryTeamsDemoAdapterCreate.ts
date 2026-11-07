import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoRealmId } from "../../demo/demoRealmId.js"
import { demoResourceIdGenerate } from "../../demo/demoResourceIdGenerate.js"
import { teamCreateRequestSchema } from "../../teams/public/teamCreateRequestSchema.js"
import type { Team } from "../../teams/public/teamSchema.js"
import { teamUpdateRequestSchema } from "../../teams/public/teamUpdateRequestSchema.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import type { DirectoryUserListQuery } from "../public/directoryUserListSchema.js"
import { directoryUserListQuerySchema } from "../public/directoryUserListSchema.js"
import type { DirectoryTeamsAdapter } from "./directoryTeamsAdapter.js"
import type { DirectoryAdminDemoDirectoryStore } from "./directoryAdminDemoDirectoryStoreCreate.js"

const demoOrganizationId = "01900000-0000-7000-8000-000000000011"
const now = 1_755_782_400_000
const pageSize = 20

const peopleMatchesSearch = (entry: DirectoryEntry, search: string): boolean => {
  const needle = search.toLowerCase()
  return `${entry.user.userName} ${entry.user.email} ${entry.user.displayName ?? ""}`.toLowerCase().includes(needle)
}

const pageTokenDecode = (pageToken: string | undefined, length: number): number => {
  if (pageToken === undefined) return 0
  const offset = Number.parseInt(pageToken, 10)
  if (!Number.isInteger(offset) || offset < 0 || offset >= length) return 0
  return offset
}

/**
 * Fixture-backed teams adapter sharing the demo directory store with the users
 * adapter, so assignments made here appear on the People tab and vice versa.
 * Conflict semantics mirror the server: unique name/slug per organization,
 * `unassigned` reserved, and a leader of one team can never join another.
 */
export function directoryTeamsDemoAdapterCreate(
  store: DirectoryAdminDemoDirectoryStore,
  fixtureState: () => DemoFixtureState,
): DirectoryTeamsAdapter {
  const neverResolves = <T>(): Promise<Result<T>> => new Promise<Result<T>>(() => undefined)
  const denied = <T>(op: string): Result<T> => {
    const failure = resultErrorCodedCreate(op, "You do not manage this organization.", "teams.forbidden")
    failure.statusCode = 403
    return failure
  }
  const failed = <T>(op: string): Result<T> =>
    resultErrorCodedCreate(op, "The deterministic teams fixture failed.", "teams.read-failed")
  const gate = <T>(op: string, value: () => Result<T>): Promise<Result<T>> => {
    const state = fixtureState()
    if (state === "loading") return neverResolves<T>()
    if (state === "permission-denied") return Promise.resolve(denied<T>(op))
    if (state === "error") return Promise.resolve(failed<T>(op))
    return Promise.resolve(value())
  }
  const empty = () => fixtureState() === "empty"

  const personById = (userId: string): DirectoryEntry | undefined =>
    (empty() ? [] : store.people).find((entry) => entry.user.id === userId)

  const leaderOfGet = (userId: string) => store.teams.find((team) => team.leaderUserId === userId)

  const teamViewOf = (record: { id: string; leaderUserId: string; name: string; slug: string }): Team => {
    const leader = personById(record.leaderUserId)
    return {
      createdAt: now,
      id: record.id,
      leader: {
        displayName: leader?.user.displayName ?? null,
        email: leader?.user.email ?? null,
        userId: record.leaderUserId,
      },
      memberCount: store.people.filter((entry) => entry.team?.id === record.id).length,
      name: record.name,
      organizationId: demoOrganizationId,
      realmId: demoRealmId,
      slug: record.slug,
      updatedAt: now,
    }
  }

  const teamRefResolve = (teamRef: string) =>
    store.teams.find((team) => team.id === teamRef) ?? store.teams.find((team) => team.slug === teamRef)

  const memberTeamSet = (userId: string, team: { id: string; name: string; slug: string } | null) => {
    const person = personById(userId)
    if (person === undefined) return
    const index = store.people.indexOf(person)
    store.people[index] = { ...person, team: team === null ? null : { ...team } }
  }

  return {
    organizationUserList: (query?: DirectoryUserListQuery) =>
      gate("directoryTeamsDemoOrganizationUserList", () => {
        const parsed = v.safeParse(directoryUserListQuerySchema, query ?? {})
        if (!parsed.success)
          return resultErrorCodedCreate(
            "directoryTeamsDemoOrganizationUserList",
            "The directory list query is invalid.",
            "directory.invalid",
          )
        const input = parsed.output
        let rows = empty() ? [] : [...store.people]
        if (typeof input.search === "string" && input.search.trim().length > 0)
          rows = rows.filter((entry) => peopleMatchesSearch(entry, input.search as string))
        if (input.team !== undefined)
          rows =
            input.team === "unassigned"
              ? rows.filter((entry) => entry.team === null)
              : rows.filter((entry) => entry.team?.slug === input.team)
        const offset = pageTokenDecode(input.pageToken, rows.length)
        const limit = input.pageSize ?? pageSize
        const items = rows.slice(offset, offset + limit)
        const next = offset + limit < rows.length ? String(offset + limit) : undefined
        return resultCreate({ items, ...(next === undefined ? {} : { nextPageToken: next }) })
      }),
    teamCreate: (input) =>
      gate("directoryTeamsDemoTeamCreate", () => {
        const parsed = v.safeParse(teamCreateRequestSchema, input)
        if (!parsed.success)
          return resultErrorCodedCreate("directoryTeamsDemoTeamCreate", "The team request is invalid.", "teams.invalid")
        if (store.teams.some((team) => team.slug === parsed.output.slug))
          return resultErrorCodedCreate(
            "directoryTeamsDemoTeamCreate",
            "That slug is already used by another team.",
            "teams.slug-conflict",
          )
        if (store.teams.some((team) => team.name === parsed.output.name))
          return resultErrorCodedCreate(
            "directoryTeamsDemoTeamCreate",
            "That name is already used by another team.",
            "teams.name-conflict",
          )
        if (personById(parsed.output.leaderUserId) === undefined)
          return resultErrorCodedCreate(
            "directoryTeamsDemoTeamCreate",
            "The team leader is not an organization member.",
            "teams.not-member",
          )
        if (leaderOfGet(parsed.output.leaderUserId) !== undefined)
          return resultErrorCodedCreate(
            "directoryTeamsDemoTeamCreate",
            "That person already leads another team.",
            "teams.leader-conflict",
          )
        const record = {
          id: demoResourceIdGenerate(),
          leaderUserId: parsed.output.leaderUserId,
          name: parsed.output.name,
          slug: parsed.output.slug,
        }
        store.teams.push(record)
        memberTeamSet(record.leaderUserId, { id: record.id, name: record.name, slug: record.slug })
        return resultCreate({ team: teamViewOf(record) })
      }),
    teamDelete: (teamRef) =>
      gate("directoryTeamsDemoTeamDelete", () => {
        const record = teamRefResolve(teamRef)
        if (record === undefined)
          return resultErrorCodedCreate("directoryTeamsDemoTeamDelete", "The team was not found.", "teams.not-found")
        store.teams.splice(store.teams.indexOf(record), 1)
        for (const entry of store.people.filter((person) => person.team?.id === record.id))
          memberTeamSet(entry.user.id, null)
        return resultCreate({ deleted: true as const })
      }),
    teamList: () =>
      gate("directoryTeamsDemoTeamList", () =>
        resultCreate({
          items: (empty() ? [] : store.teams).map(teamViewOf),
          unassignedCount: (empty() ? [] : store.people).filter((entry) => entry.team === null).length,
        }),
      ),
    teamMemberAssign: (teamRef, input) =>
      gate("directoryTeamsDemoTeamMemberAssign", () => {
        const record = teamRefResolve(teamRef)
        if (record === undefined)
          return resultErrorCodedCreate(
            "directoryTeamsDemoTeamMemberAssign",
            "The team was not found.",
            "teams.not-found",
          )
        if (personById(input.userId) === undefined)
          return resultErrorCodedCreate(
            "directoryTeamsDemoTeamMemberAssign",
            "The person is not an organization member.",
            "teams.not-member",
          )
        const leads = leaderOfGet(input.userId)
        if (leads !== undefined && leads.id !== record.id)
          return resultErrorCodedCreate(
            "directoryTeamsDemoTeamMemberAssign",
            "That person already leads another team.",
            "teams.leader-conflict",
          )
        memberTeamSet(input.userId, { id: record.id, name: record.name, slug: record.slug })
        return resultCreate({ team: teamViewOf(record) })
      }),
    teamMemberUnassign: (teamRef, userId) =>
      gate("directoryTeamsDemoTeamMemberUnassign", () => {
        const record = teamRefResolve(teamRef)
        if (record === undefined)
          return resultErrorCodedCreate(
            "directoryTeamsDemoTeamMemberUnassign",
            "The team was not found.",
            "teams.not-found",
          )
        if (record.leaderUserId === userId)
          return resultErrorCodedCreate(
            "directoryTeamsDemoTeamMemberUnassign",
            "The team leader cannot be removed without transferring leadership first.",
            "teams.leader-conflict",
          )
        memberTeamSet(userId, null)
        return resultCreate({ unassigned: true as const })
      }),
    teamUpdate: (teamRef, input) =>
      gate("directoryTeamsDemoTeamUpdate", () => {
        const parsed = v.safeParse(teamUpdateRequestSchema, input)
        if (!parsed.success)
          return resultErrorCodedCreate("directoryTeamsDemoTeamUpdate", "The team update is invalid.", "teams.invalid")
        const record = teamRefResolve(teamRef)
        if (record === undefined)
          return resultErrorCodedCreate("directoryTeamsDemoTeamUpdate", "The team was not found.", "teams.not-found")
        if (parsed.output.slug !== undefined && parsed.output.slug !== record.slug) {
          if (store.teams.some((team) => team.slug === parsed.output.slug && team.id !== record.id))
            return resultErrorCodedCreate(
              "directoryTeamsDemoTeamUpdate",
              "That slug is already used by another team.",
              "teams.slug-conflict",
            )
          record.slug = parsed.output.slug
        }
        if (parsed.output.name !== undefined && parsed.output.name !== record.name) {
          if (store.teams.some((team) => team.name === parsed.output.name && team.id !== record.id))
            return resultErrorCodedCreate(
              "directoryTeamsDemoTeamUpdate",
              "That name is already used by another team.",
              "teams.name-conflict",
            )
          record.name = parsed.output.name
        }
        if (parsed.output.leaderUserId !== undefined && parsed.output.leaderUserId !== record.leaderUserId) {
          if (personById(parsed.output.leaderUserId) === undefined)
            return resultErrorCodedCreate(
              "directoryTeamsDemoTeamUpdate",
              "The team leader is not an organization member.",
              "teams.not-member",
            )
          if (leaderOfGet(parsed.output.leaderUserId) !== undefined)
            return resultErrorCodedCreate(
              "directoryTeamsDemoTeamUpdate",
              "That person already leads another team.",
              "teams.leader-conflict",
            )
          record.leaderUserId = parsed.output.leaderUserId
          memberTeamSet(record.leaderUserId, { id: record.id, name: record.name, slug: record.slug })
        }
        for (const entry of store.people.filter((person) => person.team?.id === record.id))
          memberTeamSet(entry.user.id, { id: record.id, name: record.name, slug: record.slug })
        return resultCreate({ team: teamViewOf(record) })
      }),
  }
}

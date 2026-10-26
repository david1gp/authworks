import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoRealmId } from "../../demo/demoRealmId.js"
import { demoResourceIdGenerate } from "../../demo/demoResourceIdGenerate.js"
import { machineScopeSchema } from "../../machineUsers/public/machineScopeSchema.js"
import type { MachineUserCreateRequest } from "../../machineUsers/public/machineUserCreateRequestSchema.js"
import type { MachineUser } from "../../machineUsers/public/machineUserSchema.js"
import type { OrganizationInvitationCreateRequest } from "../../organizations/public/organizationInvitationCreateRequestSchema.js"
import { organizationInvitationCreateRequestSchema } from "../../organizations/public/organizationInvitationCreateRequestSchema.js"
import type { OrganizationInvitation } from "../../organizations/public/organizationInvitationSchema.js"
import { userCreateRequestSchema } from "../../users/public/userCreateRequestSchema.js"
import type { User } from "../../users/public/userSchema.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import type { DirectoryUserListQuery } from "../public/directoryUserListSchema.js"
import { directoryUserListQuerySchema } from "../public/directoryUserListSchema.js"
import type { DirectoryAdminAdapter } from "./directoryAdminAdapter.js"
import {
  directoryAdminDemoInvitations,
  directoryAdminDemoPeople,
  directoryAdminDemoServiceAccounts,
  directoryAdminDemoSummary,
} from "./directoryAdminDemoDirectoryFixtures.js"

const demoOrganizationId = "01900000-0000-7000-8000-000000000011"
const now = 1_755_782_400_000
const pageSize = 20

const peopleMatchesSearch = (entry: DirectoryEntry, search: string): boolean => {
  const needle = search.toLowerCase()
  return `${entry.user.userName} ${entry.user.email} ${entry.user.displayName ?? ""}`.toLowerCase().includes(needle)
}

const sortValue = (entry: DirectoryEntry, sortBy: string): number | string | undefined => {
  if (sortBy === "userName") return entry.user.userName
  if (sortBy === "lastSignInAt") return entry.user.lastSignInAt
  return entry.user.createdAt
}

const pageTokenDecode = (pageToken: string | undefined, length: number): number => {
  if (pageToken === undefined) return 0
  const offset = Number.parseInt(pageToken, 10)
  if (!Number.isInteger(offset) || offset < 0 || offset >= length) return 0
  return offset
}

/**
 * Fixture-backed adapter. It performs no network access and honours every URL parameter
 * the production adapter sends to the server (search, role, sort, pagination), so the
 * demo page exercises the same state machine as production.
 */
export function directoryAdminDemoAdapterCreate(
  fixtureState: () => DemoFixtureState,
  demoAccess: () => "owner" | "admin" | "realm-admin",
): DirectoryAdminAdapter {
  const people: DirectoryEntry[] = directoryAdminDemoPeople.map((entry) => ({
    memberships: entry.memberships.map((membership) => ({ ...membership, roles: [...membership.roles] })),
    user: { ...entry.user },
  }))
  const serviceAccounts: MachineUser[] = directoryAdminDemoServiceAccounts.map((account) => ({
    ...account,
    scopes: [...account.scopes],
  }))
  const invitations: OrganizationInvitation[] = directoryAdminDemoInvitations.map((invitation) => ({
    ...invitation,
    roles: [...invitation.roles],
  }))

  const neverResolves = <T>(): Promise<Result<T>> => new Promise<Result<T>>(() => undefined)
  const denied = <T>(op: string): Result<T> => {
    const failure = resultErrorCodedCreate(op, "You do not manage this organization.", "organizations.forbidden")
    failure.statusCode = 403
    return failure
  }
  const failed = <T>(op: string): Result<T> =>
    resultErrorCodedCreate(op, "The deterministic directory fixture failed.", "directory.invalid")
  const gate = <T>(op: string, value: () => Result<T>): Promise<Result<T>> => {
    const state = fixtureState()
    if (state === "loading") return neverResolves<T>()
    if (state === "permission-denied") return Promise.resolve(denied<T>(op))
    if (state === "error") return Promise.resolve(failed<T>(op))
    return Promise.resolve(value())
  }
  const empty = () => fixtureState() === "empty"

  // The `?as=` role gates writes the same way the server would: admins never create users,
  // and nobody but a realm administrator may invite with the `owner` role.
  const inviteRolesValidate = (input: OrganizationInvitationCreateRequest): boolean => {
    if (demoAccess() === "realm-admin") return true
    if (input.roles.includes("owner")) return false
    return true
  }

  const peopleList = (query?: DirectoryUserListQuery, organizationId?: string) => {
    const parsed = v.safeParse(directoryUserListQuerySchema, query ?? {})
    if (!parsed.success)
      return resultErrorCodedCreate(
        "directoryAdminDemoPeopleList",
        "The directory list query is invalid.",
        "directory.invalid",
      )
    const input = parsed.output
    const role = input.role
    let rows = empty() ? [] : [...people]
    if (typeof input.search === "string" && input.search.trim().length > 0)
      rows = rows.filter((entry) => peopleMatchesSearch(entry, input.search as string))
    if (role !== undefined)
      rows = rows.filter((entry) =>
        entry.memberships.some(
          (membership) =>
            (organizationId === undefined || membership.organizationId === organizationId) &&
            membership.roles.includes(role),
        ),
      )
    const sortBy = input.sortBy ?? "lastSignInAt"
    const direction = input.sortDirection ?? (sortBy === "userName" ? "asc" : "desc")
    rows.sort((left, right) => {
      const leftValue = sortValue(left, sortBy)
      const rightValue = sortValue(right, sortBy)
      if (leftValue === undefined && rightValue === undefined) return 0
      if (leftValue === undefined) return 1
      if (rightValue === undefined) return 1
      if (leftValue === rightValue) return 0
      const comparison = leftValue < rightValue ? -1 : 1
      return direction === "asc" ? comparison : -comparison
    })
    const offset = pageTokenDecode(input.pageToken, rows.length)
    const limit = input.pageSize ?? pageSize
    const items = rows.slice(offset, offset + limit)
    const next = offset + limit < rows.length ? String(offset + limit) : undefined
    return resultCreate({ items, ...(next === undefined ? {} : { nextPageToken: next }) })
  }

  const invitationListApply = (query?: ListQuery) => {
    const items = empty() ? [] : [...invitations]
    const offset = pageTokenDecode(query?.pageToken, items.length)
    const limit = query?.pageSize ?? pageSize
    const page = items.slice(offset, offset + limit)
    const next = offset + limit < items.length ? String(offset + limit) : undefined
    return resultCreate({ items: page, ...(next === undefined ? {} : { nextPageToken: next }) })
  }

  return {
    directoryUserCreate: (input) =>
      gate("directoryAdminDemoUserCreate", () => {
        if (demoAccess() !== "realm-admin")
          return resultErrorCodedCreate(
            "directoryAdminDemoUserCreate",
            "You do not manage this organization.",
            "organizations.forbidden",
          )
        const parsed = v.safeParse(userCreateRequestSchema, input)
        if (!parsed.success)
          return resultErrorCodedCreate("directoryAdminDemoUserCreate", "The user request is invalid.", "users.invalid")
        const profile = parsed.output.profile as { displayName?: string; firstName?: string; lastName?: string }
        const user: User = {
          createdAt: now,
          email: parsed.output.email,
          emailVerified: false,
          id: demoResourceIdGenerate(),
          realmId: demoRealmId,
          profile: {
            ...(profile.displayName === undefined ? {} : { displayName: profile.displayName }),
            ...(profile.firstName === undefined ? {} : { firstName: profile.firstName }),
            ...(profile.lastName === undefined ? {} : { lastName: profile.lastName }),
          },
          state: "initial",
          updatedAt: now,
          userName: parsed.output.userName,
          verificationState: "unverified",
        }
        people.push({
          memberships: [
            {
              createdAt: now,
              membershipId: demoResourceIdGenerate(),
              organizationId: demoOrganizationId,
              organizationName: "Acme Corporation",
              roles: ["member"],
            },
          ],
          user: {
            createdAt: user.createdAt,
            ...(user.profile.displayName === undefined ? {} : { displayName: user.profile.displayName }),
            email: user.email,
            emailVerified: false,
            id: user.id,
            state: user.state,
            userName: user.userName,
            verificationState: user.verificationState,
          },
        })
        return resultCreate({ user })
      }),
    invitationCreate: (input) =>
      gate("directoryAdminDemoInvitationCreate", () => {
        const parsed = v.safeParse(organizationInvitationCreateRequestSchema, input)
        if (!parsed.success || !inviteRolesValidate(parsed.output))
          return resultErrorCodedCreate(
            "directoryAdminDemoInvitationCreate",
            "The invitation request is invalid.",
            "organizations.invalid",
          )
        const invitation: OrganizationInvitation = {
          acceptedAt: null,
          createdAt: now,
          email: parsed.output.email,
          expiresAt: now + 604_800_000,
          id: demoResourceIdGenerate(),
          organizationId: demoOrganizationId,
          realmId: demoRealmId,
          roles: [...parsed.output.roles],
          status: "pending",
          updatedAt: now,
        }
        invitations.unshift(invitation)
        return resultCreate({ invitation, token: "demo-invitation-token-0f9c31a7e5b24d68" })
      }),
    invitationList: (query?: ListQuery) => gate("directoryAdminDemoInvitationList", () => invitationListApply(query)),
    invitationRevoke: (invitationId) =>
      gate("directoryAdminDemoInvitationRevoke", () => {
        const index = invitations.findIndex((item) => item.id === invitationId)
        if (index < 0)
          return resultErrorCodedCreate(
            "directoryAdminDemoInvitationRevoke",
            "The invitation was not found.",
            "organizations.not-found",
          )
        invitations.splice(index, 1)
        return resultCreate({ revoked: true as const })
      }),
    organizationUserList: (query?: DirectoryUserListQuery) =>
      gate("directoryAdminDemoOrganizationUserList", () => peopleList(query, demoOrganizationId)),
    organizationUserSummary: () =>
      gate("directoryAdminDemoOrganizationUserSummary", () =>
        resultCreate(
          empty()
            ? { roles: { admin: 0, guest: 0, member: 0, owner: 0 }, total: 0 }
            : { ...directoryAdminDemoSummary, roles: { ...directoryAdminDemoSummary.roles } },
        ),
      ),
    realmUserList: (query?: DirectoryUserListQuery) =>
      gate("directoryAdminDemoRealmUserList", () => {
        if (demoAccess() !== "realm-admin")
          return resultErrorCodedCreate(
            "directoryAdminDemoRealmUserList",
            "You do not manage this organization.",
            "organizations.forbidden",
          )
        return peopleList(query)
      }),
    serviceAccountCreate: (input: MachineUserCreateRequest) =>
      gate("directoryAdminDemoServiceAccountCreate", () => {
        const scopes = input.scopes === undefined ? [] : [...input.scopes]
        for (const scope of scopes) {
          if (!v.safeParse(machineScopeSchema, scope).success)
            return resultErrorCodedCreate(
              "directoryAdminDemoServiceAccountCreate",
              "The machine user request is invalid.",
              "machine-users.invalid",
            )
        }
        if (input.displayName.trim().length === 0 || input.userName.trim().length === 0)
          return resultErrorCodedCreate(
            "directoryAdminDemoServiceAccountCreate",
            "The machine user request is invalid.",
            "machine-users.invalid",
          )
        const machineUser: MachineUser = {
          createdAt: now,
          displayName: input.displayName,
          id: demoResourceIdGenerate(),
          realmId: demoRealmId,
          scopes,
          status: "active",
          updatedAt: now,
          userName: input.userName,
        }
        serviceAccounts.push(machineUser)
        return resultCreate({
          clientId: machineUser.userName,
          machineUser,
          secret: `demo-secret-${demoResourceIdGenerate().replaceAll("-", "")}0000000000`,
        })
      }),
    serviceAccountList: (query?: ListQuery) =>
      gate("directoryAdminDemoServiceAccountList", () => {
        const items = empty() ? [] : [...serviceAccounts]
        const offset = pageTokenDecode(query?.pageToken, items.length)
        const limit = query?.pageSize ?? pageSize
        const page = items.slice(offset, offset + limit)
        const next = offset + limit < items.length ? String(offset + limit) : undefined
        return resultCreate({ items: page, ...(next === undefined ? {} : { nextPageToken: next }) })
      }),
  }
}

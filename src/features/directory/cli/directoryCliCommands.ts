import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { connectionProfileCliCentralFlags } from "../../connectionProfiles/cli/connectionProfileCliCentralFlags.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { directoryApiClientCreate } from "../client/directoryApiClientCreate.js"
import type { DirectoryUserListQuery } from "../public/directoryUserListSchema.js"

type DirectoryCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly token?: string
  readonly realmId?: string
}

type DirectoryListCliFlags = DirectoryCliFlags & {
  readonly pageSize?: number
  readonly pageToken?: string
  readonly role?: "owner" | "admin" | "member" | "guest"
  readonly sortBy?: "createdAt" | "lastSignInAt" | "userName"
  readonly sortDirection?: "asc" | "desc"
}

const directoryRealmUsersCommand = buildCommand({
  async func(this: ApplicationContext, flags: DirectoryListCliFlags) {
    const resolved = await directoryCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    directoryCliResultWrite(
      this,
      await directoryCliClientCreate(resolved.connection).directoryRealmUserList(
        resolved.realmId,
        directoryListQueryCreate(flags),
      ),
      [resolved.connection.token],
    )
  },
  parameters: { flags: { ...directoryCommonFlags(), ...directoryListFlags() } },
  docs: { brief: "List realm directory users" },
})

const directoryOrganizationUsersCommand = buildCommand({
  async func(this: ApplicationContext, flags: DirectoryListCliFlags & { organizationId?: string }) {
    const resolved = await directoryCliConnectionResolve(this, flags, true)
    if (resolved === undefined || resolved.organizationId === undefined) return
    directoryCliResultWrite(
      this,
      await directoryCliClientCreate(resolved.connection).directoryOrganizationUserList(
        resolved.realmId,
        resolved.organizationId,
        directoryListQueryCreate(flags),
      ),
      [resolved.connection.token],
    )
  },
  parameters: {
    flags: {
      ...directoryCommonFlags(),
      ...directoryListFlags(),
      organizationId: directoryOrganizationIdFlag(),
    },
  },
  docs: { brief: "List organization directory users" },
})

const directoryOrganizationSummaryCommand = buildCommand({
  async func(this: ApplicationContext, flags: DirectoryCliFlags & { organizationId?: string }) {
    const resolved = await directoryCliConnectionResolve(this, flags, true)
    if (resolved === undefined || resolved.organizationId === undefined) return
    directoryCliResultWrite(
      this,
      await directoryCliClientCreate(resolved.connection).directoryOrganizationUserSummary(
        resolved.realmId,
        resolved.organizationId,
      ),
      [resolved.connection.token],
    )
  },
  parameters: { flags: { ...directoryCommonFlags(), organizationId: directoryOrganizationIdFlag() } },
  docs: { brief: "Summarize organization directory users" },
})

const directoryUserAccessCommand = buildCommand({
  async func(this: ApplicationContext, flags: DirectoryCliFlags & { userId: string }) {
    const resolved = await directoryCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    directoryCliResultWrite(
      this,
      await directoryCliClientCreate(resolved.connection).directoryUserAccess(resolved.realmId, flags.userId),
      [resolved.connection.token],
    )
  },
  parameters: { flags: { ...directoryCommonFlags(), userId: directoryUserIdFlag() } },
  docs: { brief: "Read a user's directory access" },
})

export const directoryCliCommands = buildRouteMap({
  routes: {
    organizationSummary: directoryOrganizationSummaryCommand,
    organizationUsers: directoryOrganizationUsersCommand,
    realmUsers: directoryRealmUsersCommand,
    userAccess: directoryUserAccessCommand,
  },
  docs: { brief: "Tenant directory users and access" },
})

async function directoryCliConnectionResolve(
  context: ApplicationContext,
  flags: DirectoryCliFlags & { readonly organizationId?: string },
  requireOrganization = false,
) {
  const result = await connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
  if (!result.success) {
    directoryCliResultWrite(context, result, [flags.token, context.process.env?.AUTHWORKS_TOKEN])
    return undefined
  }
  const realmId = scopeIdResolve(context, result.data.realmId, "realm")
  if (realmId === undefined) return undefined
  const organizationId = scopeIdResolve(context, result.data.organizationId, "organization", requireOrganization)
  if (requireOrganization && organizationId === undefined) return undefined
  return { connection: result.data, organizationId, realmId }
}

function directoryCliClientCreate(connection: { readonly server: string; readonly token?: string }) {
  return directoryApiClientCreate({ baseUrl: connection.server, token: connection.token })
}

function directoryCliResultWrite(
  context: ApplicationContext,
  result: { data?: unknown; errorMessage?: string; success: boolean },
  secrets: readonly (string | undefined)[] = [],
) {
  if (!result.success) {
    context.process.stderr.write(
      `${connectionProfileCliOutputRedact(result.errorMessage ?? "The request failed.", secrets)}\n`,
    )
    context.process.exitCode = 1
    return
  }
  context.process.stdout.write(
    `${connectionProfileCliOutputRedact(JSON.stringify(result.data) ?? "undefined", secrets)}\n`,
  )
}

function directoryCommonFlags() {
  return {
    ...connectionProfileCliCentralFlags(),
    realmId: {
      brief: "Realm UUID",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "REALM_ID",
    },
    server: {
      brief: "Authworks server URL",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "URL",
    },
    token: {
      brief: "Session Bearer [REDACTED]",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
  }
}

function directoryListFlags() {
  return {
    pageSize: {
      brief: "Maximum items per page",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => Number(value),
      placeholder: "NUMBER",
    },
    pageToken: {
      brief: "Opaque page token",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
    role: {
      brief: "Filter by role",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value as "owner" | "admin" | "member" | "guest",
      placeholder: "ROLE",
    },
    sortBy: {
      brief: "Sort field",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value as "createdAt" | "lastSignInAt" | "userName",
      placeholder: "FIELD",
    },
    sortDirection: {
      brief: "Sort direction",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value as "asc" | "desc",
      placeholder: "DIRECTION",
    },
  }
}

function directoryListQueryCreate(flags: DirectoryListCliFlags): DirectoryUserListQuery | undefined {
  if (
    flags.pageSize === undefined &&
    flags.pageToken === undefined &&
    flags.role === undefined &&
    flags.sortBy === undefined &&
    flags.sortDirection === undefined
  )
    return undefined
  const query: DirectoryUserListQuery & ListQuery = {}
  if (flags.pageSize !== undefined) query.pageSize = flags.pageSize
  if (flags.pageToken !== undefined) query.pageToken = flags.pageToken
  if (flags.role !== undefined) query.role = flags.role
  if (flags.sortBy !== undefined) query.sortBy = flags.sortBy
  if (flags.sortDirection !== undefined) query.sortDirection = flags.sortDirection
  return query
}

function directoryOrganizationIdFlag() {
  return {
    brief: "Organization UUID",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "ORGANIZATION_ID",
  }
}

function directoryUserIdFlag() {
  return { brief: "User UUID", kind: "parsed" as const, parse: (value: string) => value, placeholder: "USER_ID" }
}

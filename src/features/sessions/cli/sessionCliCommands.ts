import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliProfileFlag } from "../../connectionProfiles/cli/connectionProfileCliProfileFlag.js"
import { sessionApiClientCreate } from "../client/sessionApiClientCreate.js"

type SessionListFlags = {
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}
type SessionCliFlags = {
  readonly profile?: string
  readonly realmId?: string
  readonly server?: string
  readonly token?: string
}

const sessionCurrentCommand = buildCommand({
  async func(this: ApplicationContext, flags: SessionCliFlags) {
    const resolved = await sessionCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    sessionCliResultWrite(this, await sessionCliClientCreate(resolved.connection).sessionCurrent(resolved.realmId), [
      resolved.connection.token,
    ])
  },
  parameters: { flags: sessionCommonFlags() },
  docs: { brief: "Read the current session" },
})

const sessionListCommand = buildCommand({
  async func(this: ApplicationContext, flags: SessionCliFlags & SessionListFlags) {
    const resolved = await sessionCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    sessionCliResultWrite(
      this,
      await sessionCliClientCreate(resolved.connection).sessionList(resolved.realmId, sessionListQueryCreate(flags)),
      [resolved.connection.token],
    )
  },
  parameters: { flags: { ...sessionCommonFlags(), ...sessionListFlags() } },
  docs: { brief: "List sessions" },
})

const sessionRecentCommand = buildCommand({
  async func(this: ApplicationContext, flags: SessionCliFlags & SessionListFlags) {
    const resolved = await sessionCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    sessionCliResultWrite(
      this,
      await sessionCliClientCreate(resolved.connection).sessionRecentList(
        resolved.realmId,
        sessionListQueryCreate(flags),
      ),
      [resolved.connection.token],
    )
  },
  parameters: { flags: { ...sessionCommonFlags(), ...sessionListFlags() } },
  docs: { brief: "List recent sessions" },
})

const sessionRotateCommand = buildCommand({
  async func(this: ApplicationContext, flags: SessionCliFlags) {
    const resolved = await sessionCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    sessionCliResultWrite(this, await sessionCliClientCreate(resolved.connection).sessionRotate(resolved.realmId), [
      resolved.connection.token,
    ])
  },
  parameters: { flags: sessionCommonFlags() },
  docs: { brief: "Rotate the current session credential" },
})

const sessionRevokeCommand = buildCommand({
  async func(this: ApplicationContext, flags: SessionCliFlags & { sessionId: string }) {
    const resolved = await sessionCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    sessionCliResultWrite(
      this,
      await sessionCliClientCreate(resolved.connection).sessionRevoke(resolved.realmId, flags.sessionId),
      [resolved.connection.token],
    )
  },
  parameters: { flags: { ...sessionCommonFlags(), sessionId: sessionIdFlag() } },
  docs: { brief: "Revoke a session" },
})

const sessionRevokeAllCommand = buildCommand({
  async func(this: ApplicationContext, flags: SessionCliFlags & { keepCurrent: boolean }) {
    const resolved = await sessionCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    sessionCliResultWrite(
      this,
      await sessionCliClientCreate(resolved.connection).sessionRevokeAll(resolved.realmId, {
        keepCurrent: flags.keepCurrent,
      }),
      [resolved.connection.token],
    )
  },
  parameters: { flags: { ...sessionCommonFlags(), keepCurrent: booleanFlag() } },
  docs: { brief: "Revoke all sessions" },
})

export const sessionCliCommands = buildRouteMap({
  routes: {
    current: sessionCurrentCommand,
    list: sessionListCommand,
    recent: sessionRecentCommand,
    revoke: sessionRevokeCommand,
    revokeAll: sessionRevokeAllCommand,
    rotate: sessionRotateCommand,
  },
  docs: { brief: "Manage sessions" },
})

async function sessionCliConnectionResolve(context: ApplicationContext, flags: SessionCliFlags) {
  const result = await connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
  if (!result.success) {
    sessionCliResultWrite(context, result, [flags.token, context.process.env?.AUTHWORKS_TOKEN])
    return undefined
  }
  const realmId = scopeIdResolve(context, result.data.realmId, "realm")
  if (realmId === undefined) return undefined
  return { connection: result.data, realmId }
}

function sessionCliClientCreate(connection: { readonly server: string; readonly token?: string }) {
  return sessionApiClientCreate({
    baseUrl: connection.server,
    token: connection.token,
  })
}

function sessionCliResultWrite(
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

function sessionCommonFlags() {
  return {
    realmId: realmIdFlag(),
    profile: connectionProfileCliProfileFlag(),
    server: {
      brief: "Authworks server URL",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "URL",
    },
    token: {
      brief: "Bearer token",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
  }
}

function sessionListFlags() {
  return {
    pageSize: {
      brief: "Page size",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => Number(value),
      placeholder: "NUMBER",
    },
    pageToken: {
      brief: "Page token",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
    sortBy: {
      brief: "Sort field",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
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

function sessionListQueryCreate(flags: SessionCliFlags & SessionListFlags) {
  return {
    ...(flags.pageSize === undefined ? {} : { pageSize: flags.pageSize }),
    ...(flags.pageToken === undefined ? {} : { pageToken: flags.pageToken }),
    ...(flags.sortBy === undefined ? {} : { sortBy: flags.sortBy }),
    ...(flags.sortDirection === undefined ? {} : { sortDirection: flags.sortDirection }),
  }
}

function realmIdFlag() {
  return {
    brief: "Realm UUID",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "REALM_ID",
  }
}

function sessionIdFlag() {
  return { brief: "Session UUID", kind: "parsed" as const, parse: (value: string) => value, placeholder: "SESSION_ID" }
}

function booleanFlag() {
  return {
    brief: "Keep the current session",
    kind: "parsed" as const,
    parse: (value: string) => value === "true",
    placeholder: "BOOLEAN",
  }
}

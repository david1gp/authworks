import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { sessionApiClientCreate } from "../client/sessionApiClientCreate.js"

type SessionCliFlags = {
  readonly realmId?: string
  readonly server?: string
  readonly token?: string
}

const sessionCurrentCommand = buildCommand({
  async func(this: ApplicationContext, flags: SessionCliFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    sessionCliResultWrite(this, await sessionCliClientCreate(this, flags).sessionCurrent(realmId))
  },
  parameters: { flags: sessionCommonFlags() },
  docs: { brief: "Read the current session" },
})

const sessionListCommand = buildCommand({
  async func(this: ApplicationContext, flags: SessionCliFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    sessionCliResultWrite(this, await sessionCliClientCreate(this, flags).sessionList(realmId))
  },
  parameters: { flags: sessionCommonFlags() },
  docs: { brief: "List sessions" },
})

const sessionRecentCommand = buildCommand({
  async func(this: ApplicationContext, flags: SessionCliFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    sessionCliResultWrite(this, await sessionCliClientCreate(this, flags).sessionRecentList(realmId))
  },
  parameters: { flags: sessionCommonFlags() },
  docs: { brief: "List recent sessions" },
})

const sessionRotateCommand = buildCommand({
  async func(this: ApplicationContext, flags: SessionCliFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    sessionCliResultWrite(this, await sessionCliClientCreate(this, flags).sessionRotate(realmId))
  },
  parameters: { flags: sessionCommonFlags() },
  docs: { brief: "Rotate the current session credential" },
})

const sessionRevokeCommand = buildCommand({
  async func(this: ApplicationContext, flags: SessionCliFlags & { sessionId: string }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    sessionCliResultWrite(this, await sessionCliClientCreate(this, flags).sessionRevoke(realmId, flags.sessionId))
  },
  parameters: { flags: { ...sessionCommonFlags(), sessionId: sessionIdFlag() } },
  docs: { brief: "Revoke a session" },
})

const sessionRevokeAllCommand = buildCommand({
  async func(this: ApplicationContext, flags: SessionCliFlags & { keepCurrent: boolean }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    sessionCliResultWrite(
      this,
      await sessionCliClientCreate(this, flags).sessionRevokeAll(realmId, { keepCurrent: flags.keepCurrent }),
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

function sessionCliClientCreate(context: ApplicationContext, flags: SessionCliFlags) {
  return sessionApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.ZITADEL_V2_TOKEN,
  })
}

function sessionCliResultWrite(
  context: ApplicationContext,
  result: { data?: unknown; errorMessage?: string; success: boolean },
) {
  if (!result.success) {
    context.process.stderr.write(`${result.errorMessage ?? "The request failed."}\n`)
    context.process.exitCode = 1
    return
  }
  context.process.stdout.write(`${JSON.stringify(result.data)}\n`)
}

function sessionCommonFlags() {
  return {
    realmId: realmIdFlag(),
    server: {
      brief: "ZITADEL v2 server URL",
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

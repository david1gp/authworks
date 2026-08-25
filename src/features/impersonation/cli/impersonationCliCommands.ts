import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliProfileFlag } from "../../connectionProfiles/cli/connectionProfileCliProfileFlag.js"
import { impersonationApiClientCreate } from "../client/impersonationApiClientCreate.js"

type ImpersonationCliFlags = {
  readonly profile?: string
  readonly realmId?: string
  readonly server?: string
  readonly token?: string
}

const impersonationStartCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ImpersonationCliFlags & {
      durationSeconds: number
      organizationId?: string
      reason: string
      targetUserId: string
    },
  ) {
    const connection = await impersonationCliConnectionResolve(this, flags)
    if (!connection.success) {
      impersonationCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const organizationId = scopeIdResolve(this, connection.data.organizationId, "organization", false)
    if (realmId === undefined) return
    const result = await impersonationCliClientCreate(connection.data).impersonationStart(realmId, {
      durationSeconds: flags.durationSeconds,
      ...(organizationId === undefined ? {} : { organizationId }),
      reason: flags.reason,
      targetUserId: flags.targetUserId,
    })
    impersonationCliResultWrite(this, result, [connection.data.token])
  },
  parameters: {
    flags: {
      ...impersonationCommonFlags(),
      durationSeconds: numberFlag("Duration in seconds, at most 900"),
      organizationId: optionalTextFlag("Organization UUID"),
      reason: textFlag("Reason for impersonation"),
      targetUserId: textFlag("Target user UUID"),
    },
  },
  docs: { brief: "Start an administrator impersonation session" },
})

const impersonationEndCommand = buildCommand({
  async func(this: ApplicationContext, flags: ImpersonationCliFlags & { sessionId: string }) {
    const connection = await impersonationCliConnectionResolve(this, flags)
    if (!connection.success) {
      impersonationCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    impersonationCliResultWrite(
      this,
      await impersonationCliClientCreate(connection.data).impersonationEnd(realmId, flags.sessionId),
      [connection.data.token],
    )
  },
  parameters: { flags: { ...impersonationCommonFlags(), sessionId: textFlag("Impersonation session UUID") } },
  docs: { brief: "End an administrator impersonation session" },
})

export const impersonationCliCommands = buildRouteMap({
  routes: { end: impersonationEndCommand, start: impersonationStartCommand },
  docs: { brief: "Manage administrator impersonation" },
})

async function impersonationCliConnectionResolve(context: ApplicationContext, flags: ImpersonationCliFlags) {
  return connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
}

function impersonationCliClientCreate(flags: { readonly server: string; readonly token?: string }) {
  return impersonationApiClientCreate({
    baseUrl: flags.server,
    token: flags.token,
  })
}

function impersonationCliResultWrite(
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

function impersonationCommonFlags() {
  return {
    profile: connectionProfileCliProfileFlag(),
    realmId: { ...textFlag("Realm UUID"), optional: true as const },
    server: optionalTextFlag("Authworks server URL"),
    token: optionalTextFlag("Bearer token"),
  }
}

function textFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function optionalTextFlag(brief: string) {
  return { ...textFlag(brief), optional: true as const }
}

function numberFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => Number(value), placeholder: "NUMBER" }
}

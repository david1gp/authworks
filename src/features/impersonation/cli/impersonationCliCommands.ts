import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { impersonationApiClientCreate } from "../client/impersonationApiClientCreate.js"

type ImpersonationCliFlags = {
  readonly instanceId: string
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
    const result = await impersonationCliClientCreate(this, flags).impersonationStart(flags.instanceId, {
      durationSeconds: flags.durationSeconds,
      ...(flags.organizationId === undefined ? {} : { organizationId: flags.organizationId }),
      reason: flags.reason,
      targetUserId: flags.targetUserId,
    })
    impersonationCliResultWrite(this, result)
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
    impersonationCliResultWrite(
      this,
      await impersonationCliClientCreate(this, flags).impersonationEnd(flags.instanceId, flags.sessionId),
    )
  },
  parameters: { flags: { ...impersonationCommonFlags(), sessionId: textFlag("Impersonation session UUID") } },
  docs: { brief: "End an administrator impersonation session" },
})

export const impersonationCliCommands = buildRouteMap({
  routes: { end: impersonationEndCommand, start: impersonationStartCommand },
  docs: { brief: "Manage administrator impersonation" },
})

function impersonationCliClientCreate(context: ApplicationContext, flags: ImpersonationCliFlags) {
  return impersonationApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.ZITADEL_V2_TOKEN,
  })
}

function impersonationCliResultWrite(
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

function impersonationCommonFlags() {
  return {
    instanceId: textFlag("Instance UUID"),
    server: optionalTextFlag("ZITADEL v2 server URL"),
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

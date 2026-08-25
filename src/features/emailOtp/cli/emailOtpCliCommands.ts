import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliProfileFlag } from "../../connectionProfiles/cli/connectionProfileCliProfileFlag.js"
import { emailOtpApiClientCreate } from "../client/emailOtpApiClientCreate.js"

type EmailOtpCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly realmId?: string
}

const emailOtpStartCommand = buildCommand({
  async func(this: ApplicationContext, flags: EmailOtpCliFlags & { email: string }) {
    const resolved = await emailOtpCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    emailOtpCliResultWrite(
      this,
      await emailOtpCliClientCreate(resolved.connection).emailOtpStart(resolved.realmId, { email: flags.email }),
    )
  },
  parameters: {
    flags: {
      ...emailOtpCommonFlags(),
      email: emailOtpTextFlag("Email address"),
    },
  },
  docs: { brief: "Request an email OTP" },
})

const emailOtpVerifyCommand = buildCommand({
  async func(this: ApplicationContext, flags: EmailOtpCliFlags & { challengeId: string; code: string }) {
    const resolved = await emailOtpCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    emailOtpCliResultWrite(
      this,
      await emailOtpCliClientCreate(resolved.connection).emailOtpVerify(resolved.realmId, {
        challengeId: flags.challengeId,
        code: flags.code,
      }),
    )
  },
  parameters: {
    flags: {
      ...emailOtpCommonFlags(),
      challengeId: emailOtpTextFlag("OTP challenge UUID"),
      code: emailOtpTextFlag("Six-digit OTP code"),
    },
  },
  docs: { brief: "Verify an email OTP" },
})

export const emailOtpCliCommands = buildRouteMap({
  routes: { start: emailOtpStartCommand, verify: emailOtpVerifyCommand },
  docs: { brief: "Email OTP authentication" },
})

async function emailOtpCliConnectionResolve(context: ApplicationContext, flags: EmailOtpCliFlags) {
  const result = await connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
  if (!result.success) {
    emailOtpCliResultWrite(context, result)
    return undefined
  }
  const realmId = scopeIdResolve(context, result.data.realmId, "realm")
  if (realmId === undefined) return undefined
  return { connection: result.data, realmId }
}

function emailOtpCliClientCreate(connection: { readonly server: string }) {
  return emailOtpApiClientCreate({
    baseUrl: connection.server,
  })
}

function emailOtpCliResultWrite(
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

function emailOtpCommonFlags() {
  return {
    profile: connectionProfileCliProfileFlag(),
    server: {
      brief: "Authworks server URL",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "URL",
    },
    realmId: {
      brief: "Realm UUID",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "REALM_ID",
    },
  }
}

function emailOtpTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

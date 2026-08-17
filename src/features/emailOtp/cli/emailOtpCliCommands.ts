import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { emailOtpApiClientCreate } from "../client/emailOtpApiClientCreate.js"

type EmailOtpCliFlags = {
  readonly server?: string
  readonly instanceId: string
}

const emailOtpStartCommand = buildCommand({
  async func(this: ApplicationContext, flags: EmailOtpCliFlags & { email: string }) {
    emailOtpCliResultWrite(
      this,
      await emailOtpCliClientCreate(this, flags).emailOtpStart(flags.instanceId, { email: flags.email }),
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
    emailOtpCliResultWrite(
      this,
      await emailOtpCliClientCreate(this, flags).emailOtpVerify(flags.instanceId, {
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

function emailOtpCliClientCreate(context: ApplicationContext, flags: Pick<EmailOtpCliFlags, "server">) {
  return emailOtpApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000",
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
    server: {
      brief: "ZITADEL v2 server URL",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "URL",
    },
    instanceId: {
      brief: "Instance UUID",
      kind: "parsed" as const,
      parse: (value: string) => value,
      placeholder: "INSTANCE_ID",
    },
  }
}

function emailOtpTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

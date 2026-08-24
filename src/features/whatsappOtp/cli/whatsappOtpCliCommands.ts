import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { whatsappOtpApiClientCreate } from "../client/whatsappOtpApiClientCreate.js"

type WhatsappOtpCliFlags = {
  readonly server?: string
  readonly realmId?: string
}

type WhatsappOtpAvailabilityCliFlags = WhatsappOtpCliFlags & {
  readonly organizationId?: string
}

const whatsappOtpAvailabilityCommand = buildCommand({
  async func(this: ApplicationContext, flags: WhatsappOtpAvailabilityCliFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    const organizationId = scopeIdResolve(this, flags.organizationId, "organization", false)
    whatsappOtpCliResultWrite(
      this,
      await whatsappOtpCliClientCreate(this, flags).whatsappOtpAvailabilityGet(realmId, organizationId),
    )
  },
  parameters: {
    flags: {
      ...whatsappOtpCommonFlags(),
      organizationId: whatsappOtpOptionalOrganizationIdFlag(),
    },
  },
  docs: { brief: "Check WhatsApp OTP availability" },
})

const whatsappOtpStartCommand = buildCommand({
  async func(this: ApplicationContext, flags: WhatsappOtpCliFlags & { phoneNumber: string }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    whatsappOtpCliResultWrite(
      this,
      await whatsappOtpCliClientCreate(this, flags).whatsappOtpStart(realmId, { phoneNumber: flags.phoneNumber }),
    )
  },
  parameters: {
    flags: {
      ...whatsappOtpCommonFlags(),
      phoneNumber: whatsappOtpTextFlag("Canonical E.164 phone number"),
    },
  },
  docs: { brief: "Request a WhatsApp OTP" },
})

const whatsappOtpResendCommand = buildCommand({
  async func(this: ApplicationContext, flags: WhatsappOtpCliFlags & { challengeId: string }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    whatsappOtpCliResultWrite(
      this,
      await whatsappOtpCliClientCreate(this, flags).whatsappOtpResend(realmId, { challengeId: flags.challengeId }),
    )
  },
  parameters: {
    flags: {
      ...whatsappOtpCommonFlags(),
      challengeId: whatsappOtpTextFlag("OTP challenge UUID"),
    },
  },
  docs: { brief: "Resend a WhatsApp OTP" },
})

const whatsappOtpVerifyCommand = buildCommand({
  async func(this: ApplicationContext, flags: WhatsappOtpCliFlags & { challengeId: string; code: string }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    whatsappOtpCliResultWrite(
      this,
      await whatsappOtpCliClientCreate(this, flags).whatsappOtpVerify(realmId, {
        challengeId: flags.challengeId,
        code: flags.code,
      }),
    )
  },
  parameters: {
    flags: {
      ...whatsappOtpCommonFlags(),
      challengeId: whatsappOtpTextFlag("OTP challenge UUID"),
      code: whatsappOtpTextFlag("Six-digit OTP code"),
    },
  },
  docs: { brief: "Verify a WhatsApp OTP" },
})

export const whatsappOtpCliCommands = buildRouteMap({
  routes: {
    availability: whatsappOtpAvailabilityCommand,
    resend: whatsappOtpResendCommand,
    start: whatsappOtpStartCommand,
    verify: whatsappOtpVerifyCommand,
  },
  docs: { brief: "WhatsApp OTP authentication" },
})

function whatsappOtpCliClientCreate(context: ApplicationContext, flags: Pick<WhatsappOtpCliFlags, "server">) {
  return whatsappOtpApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.AUTHWORKS_URL ?? "http://127.0.0.1:3000",
  })
}

function whatsappOtpCliResultWrite(
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

function whatsappOtpCommonFlags() {
  return {
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

function whatsappOtpTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function whatsappOtpOptionalOrganizationIdFlag() {
  return { ...whatsappOtpTextFlag("Organization UUID"), optional: true as const }
}

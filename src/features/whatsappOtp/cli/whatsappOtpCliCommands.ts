import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliProfileFlag } from "../../connectionProfiles/cli/connectionProfileCliProfileFlag.js"
import { whatsappOtpApiClientCreate } from "../client/whatsappOtpApiClientCreate.js"

type WhatsappOtpCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly realmId?: string
}

type WhatsappOtpAvailabilityCliFlags = WhatsappOtpCliFlags & {
  readonly organizationId?: string
}

const whatsappOtpAvailabilityCommand = buildCommand({
  async func(this: ApplicationContext, flags: WhatsappOtpAvailabilityCliFlags) {
    const connection = await whatsappOtpCliConnectionResolve(this, flags)
    if (!connection.success) return whatsappOtpCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    const organizationId = scopeIdResolve(this, connection.data.organizationId, "organization", false)
    whatsappOtpCliResultWrite(
      this,
      await whatsappOtpCliClientCreate(connection.data).whatsappOtpAvailabilityGet(realmId, organizationId),
      [connection.data.token],
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
    const connection = await whatsappOtpCliConnectionResolve(this, flags)
    if (!connection.success) return whatsappOtpCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    whatsappOtpCliResultWrite(
      this,
      await whatsappOtpCliClientCreate(connection.data).whatsappOtpStart(realmId, { phoneNumber: flags.phoneNumber }),
      [connection.data.token],
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
    const connection = await whatsappOtpCliConnectionResolve(this, flags)
    if (!connection.success) return whatsappOtpCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    whatsappOtpCliResultWrite(
      this,
      await whatsappOtpCliClientCreate(connection.data).whatsappOtpResend(realmId, { challengeId: flags.challengeId }),
      [connection.data.token],
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
    const connection = await whatsappOtpCliConnectionResolve(this, flags)
    if (!connection.success) return whatsappOtpCliResultWrite(this, connection)
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    whatsappOtpCliResultWrite(
      this,
      await whatsappOtpCliClientCreate(connection.data).whatsappOtpVerify(realmId, {
        challengeId: flags.challengeId,
        code: flags.code,
      }),
      [connection.data.token],
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

async function whatsappOtpCliConnectionResolve(context: ApplicationContext, flags: WhatsappOtpCliFlags) {
  return connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
}

function whatsappOtpCliClientCreate(flags: { readonly server: string }) {
  return whatsappOtpApiClientCreate({
    baseUrl: flags.server,
  })
}

function whatsappOtpCliResultWrite(
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

function whatsappOtpCommonFlags() {
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

function whatsappOtpTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function whatsappOtpOptionalOrganizationIdFlag() {
  return { ...whatsappOtpTextFlag("Organization UUID"), optional: true as const }
}

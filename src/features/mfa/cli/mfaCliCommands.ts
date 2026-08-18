import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { mfaApiClientCreate } from "../client/mfaApiClientCreate.js"

type MfaCliFlags = { readonly server?: string; readonly token?: string; readonly systemToken?: string }
type MfaRealmFlags = MfaCliFlags & { readonly realmId?: string }

const mfaPolicyGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: MfaRealmFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(this, await mfaCliClientCreate(this, flags).mfaPolicyGet(realmId))
  },
  parameters: { flags: { ...mfaCommonFlags(), realmId: mfaRealmIdFlag() } },
  docs: { brief: "Read the MFA policy" },
})

const mfaPolicySetCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: MfaRealmFlags & {
      lockoutDurationMs: number
      maxAttempts: number
      mode: "disabled" | "optional" | "required"
      totpWindow: number
    },
  ) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(
      this,
      await mfaCliClientCreate(this, flags).mfaPolicySet(realmId, {
        lockoutDurationMs: flags.lockoutDurationMs,
        maxAttempts: flags.maxAttempts,
        mode: flags.mode,
        totpWindow: flags.totpWindow,
      }),
    )
  },
  parameters: {
    flags: {
      ...mfaCommonFlags(),
      realmId: mfaRealmIdFlag(),
      mode: mfaModeFlag(),
      totpWindow: mfaNumberFlag("TOTP time-step window"),
      maxAttempts: mfaNumberFlag("Maximum MFA attempts"),
      lockoutDurationMs: mfaNumberFlag("MFA lockout duration in milliseconds"),
    },
  },
  docs: { brief: "Set the MFA policy" },
})

const mfaEnrollCommand = buildCommand({
  async func(this: ApplicationContext, flags: MfaRealmFlags & { label?: string }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(
      this,
      await mfaCliClientCreate(this, flags).mfaTotpEnrollmentStart(realmId, { label: flags.label }),
    )
  },
  parameters: {
    flags: {
      ...mfaCommonFlags(),
      realmId: mfaRealmIdFlag(),
      label: { ...mfaTextFlag("Authenticator label"), optional: true as const },
    },
  },
  docs: { brief: "Start TOTP enrollment" },
})

const mfaConfirmCommand = buildCommand({
  async func(this: ApplicationContext, flags: MfaRealmFlags & { code: string; enrollmentId: string }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(
      this,
      await mfaCliClientCreate(this, flags).mfaTotpEnrollmentConfirm(realmId, {
        code: flags.code,
        enrollmentId: flags.enrollmentId,
      }),
    )
  },
  parameters: {
    flags: {
      ...mfaCommonFlags(),
      realmId: mfaRealmIdFlag(),
      enrollmentId: mfaTextFlag("Enrollment ID"),
      code: mfaTextFlag("TOTP code"),
    },
  },
  docs: { brief: "Confirm TOTP enrollment" },
})

const mfaRecoveryCommand = buildCommand({
  async func(this: ApplicationContext, flags: MfaRealmFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(this, await mfaCliClientCreate(this, flags).mfaRecoveryCodesGenerate(realmId))
  },
  parameters: { flags: { ...mfaCommonFlags(), realmId: mfaRealmIdFlag() } },
  docs: { brief: "Generate single-use recovery codes" },
})

export const mfaCliCommands = buildRouteMap({
  routes: {
    confirm: mfaConfirmCommand,
    enroll: mfaEnrollCommand,
    policy: buildRouteMap({
      routes: { get: mfaPolicyGetCommand, set: mfaPolicySetCommand },
      docs: { brief: "Manage MFA policy" },
    }),
    recovery: mfaRecoveryCommand,
  },
  docs: { brief: "Manage multi-factor authentication" },
})

function mfaCliClientCreate(context: ApplicationContext, flags: MfaCliFlags) {
  return mfaApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000",
    systemToken: flags.systemToken ?? context.process.env?.ZITADEL_V2_SYSTEM_SECRET,
    token: flags.token ?? context.process.env?.ZITADEL_V2_TOKEN,
  })
}

function mfaCliResultWrite(
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

function mfaCommonFlags() {
  return {
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
    systemToken: {
      brief: "System bearer token",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
  }
}

function mfaRealmIdFlag() {
  return {
    brief: "Realm UUID",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "REALM_ID",
  }
}
function mfaTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}
function mfaNumberFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => Number(value), placeholder: "NUMBER" }
}
function mfaModeFlag() {
  return {
    brief: "MFA policy mode",
    kind: "parsed" as const,
    parse: (value: string) => value as "disabled" | "optional" | "required",
    placeholder: "MODE",
  }
}

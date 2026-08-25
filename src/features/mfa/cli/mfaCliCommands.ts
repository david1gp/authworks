import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliProfileFlag } from "../../connectionProfiles/cli/connectionProfileCliProfileFlag.js"
import { mfaApiClientCreate } from "../client/mfaApiClientCreate.js"

type MfaCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly token?: string
  readonly systemToken?: string
}
type MfaRealmFlags = MfaCliFlags & { readonly realmId?: string }

const mfaPolicyGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: MfaRealmFlags) {
    const connection = await mfaCliConnectionResolve(this, flags)
    if (!connection.success) {
      mfaCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(this, await mfaCliClientCreate(connection.data, this, flags).mfaPolicyGet(realmId), [
      connection.data.token,
      flags.systemToken,
      this.process.env?.AUTHWORKS_SYSTEM_SECRET,
    ])
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
    const connection = await mfaCliConnectionResolve(this, flags)
    if (!connection.success) {
      mfaCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(
      this,
      await mfaCliClientCreate(connection.data, this, flags).mfaPolicySet(realmId, {
        lockoutDurationMs: flags.lockoutDurationMs,
        maxAttempts: flags.maxAttempts,
        mode: flags.mode,
        totpWindow: flags.totpWindow,
      }),
      [connection.data.token, flags.systemToken, this.process.env?.AUTHWORKS_SYSTEM_SECRET],
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
    const connection = await mfaCliConnectionResolve(this, flags)
    if (!connection.success) {
      mfaCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(
      this,
      await mfaCliClientCreate(connection.data, this, flags).mfaTotpEnrollmentStart(realmId, { label: flags.label }),
      [connection.data.token, flags.systemToken, this.process.env?.AUTHWORKS_SYSTEM_SECRET],
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
    const connection = await mfaCliConnectionResolve(this, flags)
    if (!connection.success) {
      mfaCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(
      this,
      await mfaCliClientCreate(connection.data, this, flags).mfaTotpEnrollmentConfirm(realmId, {
        code: flags.code,
        enrollmentId: flags.enrollmentId,
      }),
      [connection.data.token, flags.systemToken, this.process.env?.AUTHWORKS_SYSTEM_SECRET],
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
    const connection = await mfaCliConnectionResolve(this, flags)
    if (!connection.success) {
      mfaCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(this, await mfaCliClientCreate(connection.data, this, flags).mfaRecoveryCodesGenerate(realmId), [
      connection.data.token,
      flags.systemToken,
      this.process.env?.AUTHWORKS_SYSTEM_SECRET,
    ])
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

async function mfaCliConnectionResolve(context: ApplicationContext, flags: MfaCliFlags) {
  return connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
}

function mfaCliClientCreate(
  connection: { readonly server: string; readonly token?: string },
  context: ApplicationContext,
  flags: MfaCliFlags,
) {
  return mfaApiClientCreate({
    baseUrl: connection.server,
    systemToken: flags.systemToken ?? context.process.env?.AUTHWORKS_SYSTEM_SECRET,
    token: connection.token,
  })
}

function mfaCliResultWrite(
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

function mfaCommonFlags() {
  return {
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

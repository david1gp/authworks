import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { connectionProfileCliCentralFlags } from "../../connectionProfiles/cli/connectionProfileCliCentralFlags.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliSystemTokenResolve } from "../../connectionProfiles/cli/connectionProfileCliSystemTokenResolve.js"
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

const mfaTotpRemoveCommand = buildCommand({
  async func(this: ApplicationContext, flags: MfaRealmFlags & { enrollmentId?: string }) {
    const connection = await mfaCliConnectionResolve(this, flags)
    if (!connection.success) {
      mfaCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(
      this,
      await mfaCliClientCreate(connection.data, this, flags).mfaTotpEnrollmentRemove(realmId, {
        enrollmentId: flags.enrollmentId,
      }),
      [connection.data.token, flags.systemToken, this.process.env?.AUTHWORKS_SYSTEM_SECRET],
    )
  },
  parameters: {
    flags: {
      ...mfaCommonFlags(),
      realmId: mfaRealmIdFlag(),
      enrollmentId: { ...mfaTextFlag("TOTP enrollment ID"), optional: true as const },
    },
  },
  docs: { brief: "Remove a TOTP enrollment" },
})

const mfaTotpRenameCommand = buildCommand({
  async func(this: ApplicationContext, flags: MfaRealmFlags & { enrollmentId: string; label: string }) {
    const connection = await mfaCliConnectionResolve(this, flags)
    if (!connection.success) {
      mfaCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(
      this,
      await mfaCliClientCreate(connection.data, this, flags).mfaTotpEnrollmentRename(realmId, flags.enrollmentId, {
        label: flags.label,
      }),
      [connection.data.token, flags.systemToken, this.process.env?.AUTHWORKS_SYSTEM_SECRET],
    )
  },
  parameters: {
    flags: {
      ...mfaCommonFlags(),
      realmId: mfaRealmIdFlag(),
      enrollmentId: mfaTextFlag("TOTP enrollment ID"),
      label: mfaTextFlag("Authenticator label"),
    },
  },
  docs: { brief: "Rename a TOTP enrollment" },
})

const mfaTotpVerifyCommand = buildCommand({
  async func(this: ApplicationContext, flags: MfaRealmFlags & { code: string }) {
    const connection = await mfaCliConnectionResolve(this, flags)
    if (!connection.success) {
      mfaCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(this, await mfaCliClientCreate(connection.data, this, flags).mfaTotpVerify(realmId, flags.code), [
      connection.data.token,
      flags.systemToken,
      this.process.env?.AUTHWORKS_SYSTEM_SECRET,
    ])
  },
  parameters: {
    flags: { ...mfaCommonFlags(), realmId: mfaRealmIdFlag(), code: mfaTextFlag("TOTP code") },
  },
  docs: { brief: "Verify a TOTP code" },
})

const mfaStepUpStartCommand = buildCommand({
  async func(this: ApplicationContext, flags: MfaRealmFlags) {
    const connection = await mfaCliConnectionResolve(this, flags)
    if (!connection.success) {
      mfaCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(this, await mfaCliClientCreate(connection.data, this, flags).mfaStepUpStart(realmId), [
      connection.data.token,
      flags.systemToken,
      this.process.env?.AUTHWORKS_SYSTEM_SECRET,
    ])
  },
  parameters: { flags: { ...mfaCommonFlags(), realmId: mfaRealmIdFlag() } },
  docs: { brief: "Start MFA step-up authentication" },
})

const mfaStepUpCompleteCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: MfaRealmFlags & { challengeToken: string; code: string; factor?: "totp" | "email_otp" | "passkey" },
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
      await mfaCliClientCreate(connection.data, this, flags).mfaStepUpComplete(realmId, {
        code: flags.code,
        ...(flags.factor === undefined ? {} : { factor: flags.factor }),
        token: flags.challengeToken,
      }),
      [connection.data.token, flags.systemToken, this.process.env?.AUTHWORKS_SYSTEM_SECRET, flags.challengeToken],
    )
  },
  parameters: {
    flags: {
      ...mfaCommonFlags(),
      realmId: mfaRealmIdFlag(),
      challengeToken: mfaTextFlag("MFA challenge token"),
      code: mfaTextFlag("MFA code"),
      factor: { ...mfaFactorFlag(), optional: true as const },
    },
  },
  docs: { brief: "Complete MFA step-up authentication" },
})

const mfaChallengeCompleteCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: MfaRealmFlags & { challengeToken: string; code: string; factor?: "totp" | "email_otp" | "passkey" },
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
      await mfaCliClientCreate(connection.data, this, flags).mfaChallengeComplete(realmId, {
        code: flags.code,
        ...(flags.factor === undefined ? {} : { factor: flags.factor }),
        token: flags.challengeToken,
      }),
      [connection.data.token, flags.systemToken, this.process.env?.AUTHWORKS_SYSTEM_SECRET, flags.challengeToken],
    )
  },
  parameters: {
    flags: {
      ...mfaCommonFlags(),
      realmId: mfaRealmIdFlag(),
      challengeToken: mfaTextFlag("MFA challenge token"),
      code: mfaTextFlag("MFA code"),
      factor: { ...mfaFactorFlag(), optional: true as const },
    },
  },
  docs: { brief: "Complete an MFA challenge" },
})

const mfaChallengeFactorSelectCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: MfaRealmFlags & { challengeToken: string; factor: "totp" | "email_otp" | "passkey" },
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
      await mfaCliClientCreate(connection.data, this, flags).mfaChallengeFactorSelect(realmId, {
        factor: flags.factor,
        token: flags.challengeToken,
      }),
      [connection.data.token, flags.systemToken, this.process.env?.AUTHWORKS_SYSTEM_SECRET, flags.challengeToken],
    )
  },
  parameters: {
    flags: {
      ...mfaCommonFlags(),
      realmId: mfaRealmIdFlag(),
      challengeToken: mfaTextFlag("MFA challenge token"),
      factor: mfaFactorFlag(),
    },
  },
  docs: { brief: "Select an MFA challenge factor" },
})

const mfaEmailOtpStartCommand = buildCommand({
  async func(this: ApplicationContext, flags: MfaRealmFlags & { challengeToken: string }) {
    const connection = await mfaCliConnectionResolve(this, flags)
    if (!connection.success) {
      mfaCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(
      this,
      await mfaCliClientCreate(connection.data, this, flags).mfaEmailOtpStart(realmId, {
        token: flags.challengeToken,
      }),
      [connection.data.token, flags.systemToken, this.process.env?.AUTHWORKS_SYSTEM_SECRET, flags.challengeToken],
    )
  },
  parameters: {
    flags: { ...mfaCommonFlags(), realmId: mfaRealmIdFlag(), challengeToken: mfaTextFlag("MFA challenge token") },
  },
  docs: { brief: "Start MFA email OTP delivery for a challenge" },
})

const mfaRecoveryVerifyCommand = buildCommand({
  async func(this: ApplicationContext, flags: MfaRealmFlags & { code: string }) {
    const connection = await mfaCliConnectionResolve(this, flags)
    if (!connection.success) {
      mfaCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    mfaCliResultWrite(
      this,
      await mfaCliClientCreate(connection.data, this, flags).mfaRecoveryCodeVerify(realmId, flags.code),
      [connection.data.token, flags.systemToken, this.process.env?.AUTHWORKS_SYSTEM_SECRET],
    )
  },
  parameters: {
    flags: { ...mfaCommonFlags(), realmId: mfaRealmIdFlag(), code: mfaTextFlag("Recovery code") },
  },
  docs: { brief: "Verify a recovery code" },
})

export const mfaCliCommands = buildRouteMap({
  routes: {
    confirm: mfaConfirmCommand,
    enroll: mfaEnrollCommand,
    totpRemove: mfaTotpRemoveCommand,
    totpRename: mfaTotpRenameCommand,
    totpVerify: mfaTotpVerifyCommand,
    stepUpStart: mfaStepUpStartCommand,
    stepUpComplete: mfaStepUpCompleteCommand,
    challengeComplete: mfaChallengeCompleteCommand,
    challengeFactorSelect: mfaChallengeFactorSelectCommand,
    emailOtpStart: mfaEmailOtpStartCommand,
    policy: buildRouteMap({
      routes: { get: mfaPolicyGetCommand, set: mfaPolicySetCommand },
      docs: { brief: "Manage MFA policy" },
    }),
    recovery: mfaRecoveryCommand,
    recoveryVerify: mfaRecoveryVerifyCommand,
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
    systemToken: connectionProfileCliSystemTokenResolve(flags.systemToken ?? flags.token, context.process.env),
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
    ...connectionProfileCliCentralFlags(),
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
function mfaFactorFlag() {
  return {
    brief: "MFA factor",
    kind: "parsed" as const,
    parse: (value: string) => value as "totp" | "email_otp" | "passkey",
    placeholder: "FACTOR",
  }
}

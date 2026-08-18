import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { passwordApiClientCreate } from "../client/passwordApiClientCreate.js"

type PasswordCliFlags = {
  readonly server?: string
  readonly token?: string
}

type PasswordPolicyCliFlags = PasswordCliFlags & {
  readonly realmId?: string
}

const passwordPolicyGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasswordPolicyCliFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    passwordCliResultWrite(this, await passwordCliClientCreate(this, flags).passwordPolicyGet(realmId))
  },
  parameters: { flags: { ...passwordCommonFlags(), realmId: passwordRealmIdFlag() } },
  docs: { brief: "Read the password policy" },
})

const passwordPolicySetCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: PasswordPolicyCliFlags & {
      lockoutDurationMs: number
      maximumAttempts: number
      minimumLength: number
      requireLowercase: boolean
      requireNumber: boolean
      requireSymbol: boolean
      requireUppercase: boolean
    },
  ) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordPolicySet(realmId, {
        lockoutDurationMs: flags.lockoutDurationMs,
        maximumAttempts: flags.maximumAttempts,
        minimumLength: flags.minimumLength,
        requireLowercase: flags.requireLowercase,
        requireNumber: flags.requireNumber,
        requireSymbol: flags.requireSymbol,
        requireUppercase: flags.requireUppercase,
      }),
    )
  },
  parameters: {
    flags: {
      ...passwordCommonFlags(),
      realmId: passwordRealmIdFlag(),
      minimumLength: passwordNumberFlag("Minimum password length"),
      requireLowercase: passwordBooleanFlag("Require lowercase characters"),
      requireUppercase: passwordBooleanFlag("Require uppercase characters"),
      requireNumber: passwordBooleanFlag("Require numbers"),
      requireSymbol: passwordBooleanFlag("Require symbols"),
      maximumAttempts: passwordNumberFlag("Maximum failed attempts"),
      lockoutDurationMs: passwordNumberFlag("Lockout duration in milliseconds"),
    },
  },
  docs: { brief: "Set the password policy" },
})

const passwordRegisterCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: PasswordCliFlags & { email: string; password: string; realmId?: string; userName: string },
  ) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordRegister(realmId, {
        email: flags.email,
        password: flags.password,
        profile: {},
        userName: flags.userName,
      }),
    )
  },
  parameters: {
    flags: {
      ...passwordCommonFlags(),
      realmId: passwordRealmIdFlag(),
      userName: passwordTextFlag("User name"),
      email: passwordTextFlag("Email address"),
      password: passwordTextFlag("Password"),
    },
  },
  docs: { brief: "Register a password account" },
})

const passwordLoginCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: PasswordCliFlags & { identifier: string; password: string; realmId?: string },
  ) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordLogin(realmId, {
        identifier: flags.identifier,
        password: flags.password,
      }),
    )
  },
  parameters: {
    flags: {
      ...passwordCommonFlags(),
      realmId: passwordRealmIdFlag(),
      identifier: passwordTextFlag("Email or user name"),
      password: passwordTextFlag("Password"),
    },
  },
  docs: { brief: "Authenticate with a password" },
})

const passwordVerifyCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasswordCliFlags & { realmId?: string; token: string }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordEmailVerify(realmId, { token: flags.token }),
    )
  },
  parameters: {
    flags: {
      ...passwordCommonFlags(),
      realmId: passwordRealmIdFlag(),
      token: passwordTextFlag("Verification token"),
    },
  },
  docs: { brief: "Verify an email address" },
})

const passwordRecoveryRequestCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasswordCliFlags & { email: string; realmId?: string }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordRecoveryRequest(realmId, { email: flags.email }),
    )
  },
  parameters: {
    flags: { ...passwordCommonFlags(), realmId: passwordRealmIdFlag(), email: passwordTextFlag("Email address") },
  },
  docs: { brief: "Request password recovery" },
})

const passwordRecoveryCompleteCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: PasswordCliFlags & { newPassword: string; realmId?: string; token: string },
  ) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordRecoveryComplete(realmId, {
        newPassword: flags.newPassword,
        token: flags.token,
      }),
    )
  },
  parameters: {
    flags: {
      ...passwordCommonFlags(),
      realmId: passwordRealmIdFlag(),
      token: passwordTextFlag("Recovery token"),
      newPassword: passwordTextFlag("New password"),
    },
  },
  docs: { brief: "Complete password recovery" },
})

export const passwordCliCommands = buildRouteMap({
  routes: {
    change: buildCommand({
      async func(
        this: ApplicationContext,
        flags: PasswordCliFlags & { currentPassword: string; newPassword: string; realmId?: string; userId: string },
      ) {
        const realmId = scopeIdResolve(this, flags.realmId, "realm")
        if (realmId === undefined) return
        passwordCliResultWrite(
          this,
          await passwordCliClientCreate(this, flags).passwordChange(realmId, flags.userId, {
            currentPassword: flags.currentPassword,
            newPassword: flags.newPassword,
          }),
        )
      },
      parameters: {
        flags: {
          ...passwordCommonFlags(),
          realmId: passwordRealmIdFlag(),
          userId: passwordUserIdFlag(),
          currentPassword: passwordTextFlag("Current password"),
          newPassword: passwordTextFlag("New password"),
        },
      },
      docs: { brief: "Change a password" },
    }),
    login: passwordLoginCommand,
    policy: buildRouteMap({
      routes: { get: passwordPolicyGetCommand, set: passwordPolicySetCommand },
      docs: { brief: "Manage the password policy" },
    }),
    recover: buildRouteMap({
      routes: { complete: passwordRecoveryCompleteCommand, request: passwordRecoveryRequestCommand },
      docs: { brief: "Recover a password" },
    }),
    register: passwordRegisterCommand,
    verify: passwordVerifyCommand,
  },
  docs: { brief: "Password authentication" },
})

function passwordCliClientCreate(context: ApplicationContext, flags: PasswordCliFlags) {
  return passwordApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.AUTHWORKS_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.AUTHWORKS_TOKEN,
  })
}

function passwordCliResultWrite(
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

function passwordCommonFlags() {
  return {
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
  }
}

function passwordRealmIdFlag() {
  return {
    brief: "Realm UUID",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "REALM_ID",
  }
}

function passwordUserIdFlag() {
  return { brief: "User UUID", kind: "parsed" as const, parse: (value: string) => value, placeholder: "USER_ID" }
}

function passwordTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function passwordNumberFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => Number(value), placeholder: "NUMBER" }
}

function passwordBooleanFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value === "true", placeholder: "BOOLEAN" }
}

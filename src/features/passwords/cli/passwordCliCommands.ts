import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { passwordApiClientCreate } from "../client/passwordApiClientCreate.js"

type PasswordCliFlags = {
  readonly server?: string
  readonly token?: string
}

type PasswordPolicyCliFlags = PasswordCliFlags & {
  readonly instanceId: string
}

const passwordPolicyGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasswordPolicyCliFlags) {
    passwordCliResultWrite(this, await passwordCliClientCreate(this, flags).passwordPolicyGet(flags.instanceId))
  },
  parameters: { flags: { ...passwordCommonFlags(), instanceId: passwordInstanceIdFlag() } },
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
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordPolicySet(flags.instanceId, {
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
      instanceId: passwordInstanceIdFlag(),
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
    flags: PasswordCliFlags & { email: string; instanceId: string; password: string; userName: string },
  ) {
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordRegister(flags.instanceId, {
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
      instanceId: passwordInstanceIdFlag(),
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
    flags: PasswordCliFlags & { identifier: string; instanceId: string; password: string },
  ) {
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordLogin(flags.instanceId, {
        identifier: flags.identifier,
        password: flags.password,
      }),
    )
  },
  parameters: {
    flags: {
      ...passwordCommonFlags(),
      instanceId: passwordInstanceIdFlag(),
      identifier: passwordTextFlag("Email or user name"),
      password: passwordTextFlag("Password"),
    },
  },
  docs: { brief: "Authenticate with a password" },
})

const passwordVerifyCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasswordCliFlags & { instanceId: string; token: string }) {
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordEmailVerify(flags.instanceId, { token: flags.token }),
    )
  },
  parameters: {
    flags: {
      ...passwordCommonFlags(),
      instanceId: passwordInstanceIdFlag(),
      token: passwordTextFlag("Verification token"),
    },
  },
  docs: { brief: "Verify an email address" },
})

const passwordRecoveryRequestCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasswordCliFlags & { email: string; instanceId: string }) {
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordRecoveryRequest(flags.instanceId, { email: flags.email }),
    )
  },
  parameters: {
    flags: { ...passwordCommonFlags(), instanceId: passwordInstanceIdFlag(), email: passwordTextFlag("Email address") },
  },
  docs: { brief: "Request password recovery" },
})

const passwordRecoveryCompleteCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: PasswordCliFlags & { instanceId: string; newPassword: string; token: string },
  ) {
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordRecoveryComplete(flags.instanceId, {
        newPassword: flags.newPassword,
        token: flags.token,
      }),
    )
  },
  parameters: {
    flags: {
      ...passwordCommonFlags(),
      instanceId: passwordInstanceIdFlag(),
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
        flags: PasswordCliFlags & { currentPassword: string; instanceId: string; newPassword: string; userId: string },
      ) {
        passwordCliResultWrite(
          this,
          await passwordCliClientCreate(this, flags).passwordChange(flags.instanceId, flags.userId, {
            currentPassword: flags.currentPassword,
            newPassword: flags.newPassword,
          }),
        )
      },
      parameters: {
        flags: {
          ...passwordCommonFlags(),
          instanceId: passwordInstanceIdFlag(),
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
    baseUrl: flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.ZITADEL_V2_TOKEN,
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
  }
}

function passwordInstanceIdFlag() {
  return {
    brief: "Instance UUID",
    kind: "parsed" as const,
    parse: (value: string) => value,
    placeholder: "INSTANCE_ID",
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

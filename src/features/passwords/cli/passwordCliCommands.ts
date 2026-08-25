import { type ApplicationContext, buildChoiceParser, buildCommand, buildRouteMap } from "@stricli/core"
import * as v from "valibot"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { passwordApiClientCreate } from "../client/passwordApiClientCreate.js"
import { passwordContentorenSsoTestProductionEnsure } from "./passwordContentorenSsoTestProductionEnsure.js"
import { passwordContentorenSsoTestProductionEnsureExitCodeGet } from "./passwordContentorenSsoTestProductionEnsureExitCodeGet.js"
import { passwordContentorenSsoTestProductionEnsureFailureOutputCreate } from "./passwordContentorenSsoTestProductionEnsureFailureOutputCreate.js"

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
    flags: PasswordCliFlags & {
      email: string
      password: string
      phoneNumber?: string
      realmId?: string
      userName: string
      verificationMethod: "email" | "whatsapp"
    },
  ) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordRegister(realmId, {
        email: flags.email,
        password: flags.password,
        ...(flags.phoneNumber === undefined ? {} : { phoneNumber: flags.phoneNumber }),
        profile: {},
        userName: flags.userName,
        verificationMethod: flags.verificationMethod,
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
      phoneNumber: passwordOptionalTextFlag("Phone number"),
      verificationMethod: passwordVerificationMethodFlag(),
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

const passwordWhatsappVerifyCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: PasswordCliFlags & { challengeId: string; code: string; realmId?: string },
  ) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    passwordCliResultWrite(
      this,
      await passwordCliClientCreate(this, flags).passwordWhatsappVerify(realmId, {
        challengeId: flags.challengeId,
        code: flags.code,
      }),
    )
  },
  parameters: {
    flags: {
      ...passwordCommonFlags(),
      realmId: passwordRealmIdFlag(),
      challengeId: passwordTextFlag("WhatsApp challenge ID"),
      code: passwordTextFlag("WhatsApp verification code"),
    },
  },
  docs: { brief: "Verify a WhatsApp registration" },
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

const passwordContentorenSsoTestProductionEnsureCommand = buildCommand({
  async func(this: ApplicationContext) {
    const token = this.process.env?.AUTHWORKS_TOKEN
    if (token === undefined || !/^[A-Za-z0-9_-]{32,512}$/.test(token)) {
      this.process.stderr.write(
        passwordContentorenSsoTestProductionEnsureFailureOutputCreate(
          "passwords.contentoren-ssotest-ensure.authorization-unavailable",
        ),
      )
      this.process.exitCode = 1
      return
    }
    const input = await passwordContentorenSsoTestInputRead(this.process.env)
    if (!input.success) {
      this.process.stderr.write(
        passwordContentorenSsoTestProductionEnsureFailureOutputCreate(
          "passwords.contentoren-ssotest-ensure.input-invalid",
        ),
      )
      this.process.exitCode = 1
      return
    }
    try {
      const result = await passwordContentorenSsoTestProductionEnsure({
        email: input.data.email,
        password: input.data.password,
        token: new Secret(token),
      })
      if (!result.success) {
        this.process.stderr.write(passwordContentorenSsoTestProductionEnsureFailureOutputCreate(result))
        this.process.exitCode = passwordContentorenSsoTestProductionEnsureExitCodeGet(result)
        return
      }
      this.process.stdout.write(`${JSON.stringify(result.data)}\n`)
    } catch (_error) {
      this.process.stderr.write(
        passwordContentorenSsoTestProductionEnsureFailureOutputCreate(
          "passwords.contentoren-ssotest-ensure.internal-failed",
        ),
      )
      this.process.exitCode = 1
      return
    }
  },
  parameters: { flags: {} },
  docs: { brief: "Ensure the fixed Contentoren ssotest production human from private input" },
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
    contentorenSsotestProductionEnsure: passwordContentorenSsoTestProductionEnsureCommand,
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
    "verify-whatsapp": passwordWhatsappVerifyCommand,
  },
  docs: { brief: "Password authentication" },
})

async function passwordContentorenSsoTestInputRead(
  environment: Readonly<Record<string, string | undefined>> | undefined,
): Promise<
  | { readonly data: { readonly email: string; readonly password: string }; readonly success: true }
  | { readonly success: false }
> {
  const email = environment?.AUTHWORKS_CONTENTOREN_SSOTEST_EMAIL
  const password = environment?.AUTHWORKS_CONTENTOREN_SSOTEST_PASSWORD
  if (email !== undefined || password !== undefined) {
    if (email === undefined || password === undefined) return { success: false }
    return { data: { email, password }, success: true }
  }
  try {
    const text = await Bun.stdin.text()
    if (text.length > 4096) return { success: false }
    const parsedJson: unknown = JSON.parse(text)
    const parsed = v.safeParse(
      v.strictObject({
        email: v.string(),
        password: v.string(),
      }),
      parsedJson,
    )
    if (!parsed.success) return { success: false }
    return { data: parsed.output, success: true }
  } catch (_error) {
    return { success: false }
  }
}

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

function passwordOptionalTextFlag(brief: string) {
  return { ...passwordTextFlag(brief), optional: true as const }
}

function passwordVerificationMethodFlag() {
  return {
    brief: "Registration verification method",
    kind: "parsed" as const,
    default: "email",
    parse: buildChoiceParser(["email", "whatsapp"] as const),
    placeholder: "email|whatsapp",
  }
}

function passwordNumberFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => Number(value), placeholder: "NUMBER" }
}

function passwordBooleanFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value === "true", placeholder: "BOOLEAN" }
}

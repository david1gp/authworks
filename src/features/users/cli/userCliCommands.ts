import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { userApiClientCreate } from "../client/userApiClientCreate.js"

type UserCliFlags = {
  readonly server?: string
  readonly token?: string
}

type UserIdCliFlags = UserCliFlags & {
  readonly realmId: string
  readonly userId: string
}

const userCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: UserCliFlags & { displayName?: string; email: string; realmId: string; userName: string },
  ) {
    userCliResultWrite(
      this,
      await userCliClientCreate(this, flags).userCreate(flags.realmId, {
        email: flags.email,
        profile: { displayName: flags.displayName },
        userName: flags.userName,
      }),
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userName: textFlag("User name"),
      email: textFlag("Email address"),
      displayName: optionalTextFlag("Display name"),
    },
  },
  docs: { brief: "Create a user" },
})

const userListCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserCliFlags & { realmId: string }) {
    userCliResultWrite(this, await userCliClientCreate(this, flags).userList(flags.realmId))
  },
  parameters: { flags: { ...userCommonFlags(), realmId: userRealmIdFlag() } },
  docs: { brief: "List users" },
})

const userGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags) {
    userCliResultWrite(this, await userCliClientCreate(this, flags).userGet(flags.realmId, flags.userId))
  },
  parameters: { flags: { ...userCommonFlags(), realmId: userRealmIdFlag(), userId: userIdFlag() } },
  docs: { brief: "Get a user" },
})

const userProfileCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags & { displayName?: string }) {
    userCliResultWrite(
      this,
      await userCliClientCreate(this, flags).userProfileUpdate(flags.realmId, flags.userId, {
        displayName: flags.displayName,
      }),
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      displayName: optionalTextFlag("Display name"),
    },
  },
  docs: { brief: "Update a user profile" },
})

const userLifecycleCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: UserIdCliFlags & { state: "active" | "inactive" | "initial" | "locked" | "suspended" },
  ) {
    userCliResultWrite(
      this,
      await userCliClientCreate(this, flags).userLifecycleSet(flags.realmId, flags.userId, { state: flags.state }),
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      state: userStateFlag(),
    },
  },
  docs: { brief: "Change a user lifecycle state" },
})

const userVerifyCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags & { state: "unverified" | "verified" }) {
    userCliResultWrite(
      this,
      await userCliClientCreate(this, flags).userEmailVerificationSet(flags.realmId, flags.userId, {
        state: flags.state,
      }),
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      state: userVerificationStateFlag(),
    },
  },
  docs: { brief: "Change a user email verification state" },
})

const userDeleteCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags) {
    userCliResultWrite(this, await userCliClientCreate(this, flags).userDelete(flags.realmId, flags.userId))
  },
  parameters: { flags: { ...userCommonFlags(), realmId: userRealmIdFlag(), userId: userIdFlag() } },
  docs: { brief: "Delete a user account" },
})

export const userCliCommands = buildRouteMap({
  routes: {
    create: userCreateCommand,
    delete: userDeleteCommand,
    get: userGetCommand,
    list: userListCommand,
    lifecycle: userLifecycleCommand,
    profile: userProfileCommand,
    verify: userVerifyCommand,
  },
  docs: { brief: "User administration" },
})

function userCliClientCreate(context: ApplicationContext, flags: UserCliFlags) {
  return userApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.ZITADEL_V2_TOKEN,
  })
}

function userCliResultWrite(
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

function userCommonFlags() {
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

function userRealmIdFlag() {
  return {
    brief: "Realm UUID",
    kind: "parsed" as const,
    parse: (value: string) => value,
    placeholder: "REALM_ID",
  }
}

function userIdFlag() {
  return { brief: "User UUID", kind: "parsed" as const, parse: (value: string) => value, placeholder: "USER_ID" }
}

function textFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function optionalTextFlag(brief: string) {
  return { ...textFlag(brief), optional: true as const }
}

function userStateFlag() {
  return {
    brief: "Lifecycle state",
    kind: "parsed" as const,
    parse: (value: string) => value as "active" | "inactive" | "initial" | "locked" | "suspended",
    placeholder: "STATE",
  }
}

function userVerificationStateFlag() {
  return {
    brief: "Verification state",
    kind: "parsed" as const,
    parse: (value: string) => value as "unverified" | "verified",
    placeholder: "STATE",
  }
}

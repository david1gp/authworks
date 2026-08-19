import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { userApiClientCreate } from "../client/userApiClientCreate.js"

type UserCliFlags = {
  readonly server?: string
  readonly token?: string
}
type UserListCliFlags = UserCliFlags & {
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}

type UserIdCliFlags = UserCliFlags & {
  readonly realmId?: string
  readonly userId: string
}
type UserGetCliFlags = UserIdCliFlags & { readonly ifModifiedSince?: string }

const userCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: UserCliFlags & { displayName?: string; email: string; realmId?: string; userName: string },
  ) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(this, flags).userCreate(realmId, {
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
  async func(this: ApplicationContext, flags: UserListCliFlags & { realmId?: string }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(this, flags).userList(realmId, userListQueryCreate(flags)))
  },
  parameters: { flags: { ...userCommonFlags(), ...userListFlags(), realmId: userRealmIdFlag() } },
  docs: { brief: "List users" },
})

const userGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserGetCliFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(this, flags).userGet(
        realmId,
        flags.userId,
        flags.ifModifiedSince === undefined ? undefined : { ifModifiedSince: flags.ifModifiedSince },
      ),
    )
  },
  parameters: {
    flags: {
      ...userCommonFlags(),
      realmId: userRealmIdFlag(),
      userId: userIdFlag(),
      ifModifiedSince: ifModifiedSinceFlag(),
    },
  },
  docs: { brief: "Get a user" },
})

const userProfileCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserIdCliFlags & { displayName?: string }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(this, flags).userProfileUpdate(realmId, flags.userId, {
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
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(this, flags).userLifecycleSet(realmId, flags.userId, { state: flags.state }),
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
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(this, flags).userEmailVerificationSet(realmId, flags.userId, {
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
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(this, flags).userDelete(realmId, flags.userId))
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
    baseUrl: flags.server ?? context.process.env?.AUTHWORKS_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.AUTHWORKS_TOKEN,
  })
}

function userCliResultWrite(
  context: ApplicationContext,
  result: { data?: unknown; errorMessage?: string; status?: "current" | "unchanged"; success: boolean },
) {
  if (!result.success) {
    context.process.stderr.write(`${result.errorMessage ?? "The request failed."}\n`)
    context.process.exitCode = 1
    return
  }
  if (result.status === "unchanged") {
    context.process.stderr.write("304 Not Modified\n")
    return
  }
  context.process.stdout.write(`${JSON.stringify(result.data)}\n`)
}

function userCommonFlags() {
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

function userListFlags() {
  return {
    pageSize: {
      brief: "Maximum items per page",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => Number(value),
      placeholder: "NUMBER",
    },
    pageToken: {
      brief: "Opaque page token",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "TOKEN",
    },
    sortBy: {
      brief: "Sort field",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "FIELD",
    },
    sortDirection: {
      brief: "Sort direction",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value as "asc" | "desc",
      placeholder: "DIRECTION",
    },
  }
}

function userListQueryCreate(flags: UserListCliFlags): ListQuery | undefined {
  if (
    flags.pageSize === undefined &&
    flags.pageToken === undefined &&
    flags.sortBy === undefined &&
    flags.sortDirection === undefined
  )
    return undefined
  return {
    ...(flags.pageSize === undefined ? {} : { pageSize: flags.pageSize }),
    ...(flags.pageToken === undefined ? {} : { pageToken: flags.pageToken }),
    ...(flags.sortBy === undefined ? {} : { sortBy: flags.sortBy }),
    ...(flags.sortDirection === undefined ? {} : { sortDirection: flags.sortDirection }),
  }
}

function userRealmIdFlag() {
  return {
    brief: "Realm UUID",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "REALM_ID",
  }
}

function userIdFlag() {
  return { brief: "User UUID", kind: "parsed" as const, parse: (value: string) => value, placeholder: "USER_ID" }
}

function ifModifiedSinceFlag() {
  return {
    brief: "HTTP If-Modified-Since date",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "HTTP-DATE",
  }
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

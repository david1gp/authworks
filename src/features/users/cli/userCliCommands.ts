import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliProfileFlag } from "../../connectionProfiles/cli/connectionProfileCliProfileFlag.js"
import { connectionProfileCliSystemTokenResolve } from "../../connectionProfiles/cli/connectionProfileCliSystemTokenResolve.js"
import { userApiClientCreate } from "../client/userApiClientCreate.js"

type UserCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly systemToken?: string
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
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userCreate(realmId, {
        email: flags.email,
        profile: { displayName: flags.displayName },
        userName: flags.userName,
      }),
      [connection.token, connection.systemToken],
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
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(connection).userList(realmId, userListQueryCreate(flags)), [
      connection.token,
      connection.systemToken,
    ])
  },
  parameters: { flags: { ...userCommonFlags(), ...userListFlags(), realmId: userRealmIdFlag() } },
  docs: { brief: "List users" },
})

const userGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: UserGetCliFlags) {
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userGet(
        realmId,
        flags.userId,
        flags.ifModifiedSince === undefined ? undefined : { ifModifiedSince: flags.ifModifiedSince },
      ),
      [connection.token, connection.systemToken],
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
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userProfileUpdate(realmId, flags.userId, {
        displayName: flags.displayName,
      }),
      [connection.token, connection.systemToken],
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
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userLifecycleSet(realmId, flags.userId, { state: flags.state }),
      [connection.token, connection.systemToken],
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
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(
      this,
      await userCliClientCreate(connection).userEmailVerificationSet(realmId, flags.userId, {
        state: flags.state,
      }),
      [connection.token, connection.systemToken],
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
    const connection = await userCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    userCliResultWrite(this, await userCliClientCreate(connection).userDelete(realmId, flags.userId), [
      connection.token,
      connection.systemToken,
    ])
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

async function userCliConnectionResolve(
  context: ApplicationContext,
  flags: UserCliFlags & { readonly realmId?: string },
) {
  const result = await connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
  if (!result.success) {
    userCliResultWrite(context, result, [
      flags.systemToken,
      flags.token,
      context.process.env?.AUTHWORKS_SYSTEM_SECRET,
      context.process.env?.AUTHWORKS_TOKEN,
    ])
    return undefined
  }
  return {
    ...result.data,
    systemToken: connectionProfileCliSystemTokenResolve(flags.systemToken ?? flags.token, context.process.env),
  }
}

function userCliClientCreate(connection: {
  readonly server: string
  readonly systemToken?: string
  readonly token?: string
}) {
  return userApiClientCreate({
    baseUrl: connection.server,
    systemToken: connection.systemToken,
    token: connection.token,
  })
}

function userCliResultWrite(
  context: ApplicationContext,
  result: { data?: unknown; errorMessage?: string; status?: "current" | "unchanged"; success: boolean },
  secrets: readonly (string | undefined)[] = [],
) {
  if (!result.success) {
    context.process.stderr.write(
      `${connectionProfileCliOutputRedact(result.errorMessage ?? "The request failed.", secrets)}\n`,
    )
    context.process.exitCode = 1
    return
  }
  if (result.status === "unchanged") {
    context.process.stderr.write("304 Not Modified\n")
    return
  }
  context.process.stdout.write(
    `${connectionProfileCliOutputRedact(JSON.stringify(result.data) ?? "undefined", secrets)}\n`,
  )
}

function userCommonFlags() {
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

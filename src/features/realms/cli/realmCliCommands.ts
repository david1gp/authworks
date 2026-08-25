import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliProfileFlag } from "../../connectionProfiles/cli/connectionProfileCliProfileFlag.js"
import { realmApiClientCreate } from "../client/realmApiClientCreate.js"
import type { RealmCreateRequest } from "../public/realmCreateRequestSchema.js"

type RealmCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly token?: string
}
type RealmListCliFlags = RealmCliFlags & {
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}

type RealmCreateCliFlags = RealmCliFlags & {
  readonly domain: string
  readonly name: string
}

type RealmBootstrapCliFlags = RealmCliFlags & {
  readonly realmId?: string
}

const realmCreateCommand = buildCommand({
  async func(this: ApplicationContext, flags: RealmCreateCliFlags) {
    const connection = await realmCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const client = realmCliClientCreate(connection)
    const result = await client.realmCreate({
      domain: flags.domain,
      name: flags.name,
    } satisfies RealmCreateRequest)
    realmCliResultWrite(this, result)
  },
  parameters: {
    flags: {
      profile: connectionProfileCliProfileFlag(),
      domain: {
        brief: "Primary realm domain",
        kind: "parsed",
        parse: (value: string) => value,
        placeholder: "DOMAIN",
      },
      name: { brief: "Realm display name", kind: "parsed", parse: (value: string) => value, placeholder: "NAME" },
      server: {
        brief: "Authworks server URL",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "URL",
      },
      token: {
        brief: "System bearer token",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "TOKEN",
      },
    },
  },
  docs: { brief: "Create a realm" },
})

const realmListCommand = buildCommand({
  async func(this: ApplicationContext, flags: RealmListCliFlags) {
    const connection = await realmCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const result = await realmCliClientCreate(connection).realmList(realmListQueryCreate(flags))
    realmCliResultWrite(this, result)
  },
  parameters: {
    flags: {
      profile: connectionProfileCliProfileFlag(),
      server: {
        brief: "Authworks server URL",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "URL",
      },
      token: {
        brief: "System bearer token",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "TOKEN",
      },
      ...realmListFlags(),
    },
  },
  docs: { brief: "List realms" },
})

const realmBootstrapCommand = buildCommand({
  async func(this: ApplicationContext, flags: RealmBootstrapCliFlags) {
    const connection = await realmCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    const result = await realmCliClientCreate(connection).realmBootstrapAdminCreate(realmId)
    realmCliResultWrite(this, result)
  },
  parameters: {
    flags: {
      profile: connectionProfileCliProfileFlag(),
      realmId: {
        brief: "Realm UUID",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "REALM_ID",
      },
      server: {
        brief: "Authworks server URL",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "URL",
      },
      token: {
        brief: "System bearer token",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "TOKEN",
      },
    },
  },
  docs: { brief: "Create the one-time bootstrap administrator secret" },
})

export const realmCliCommands = buildRouteMap({
  routes: {
    bootstrapAdmin: realmBootstrapCommand,
    create: realmCreateCommand,
    list: realmListCommand,
  },
  docs: { brief: "Realm administration" },
})

function realmCliClientCreate(connection: { readonly server: string; readonly token?: string }) {
  return realmApiClientCreate({ baseUrl: connection.server, token: connection.token })
}

async function realmCliConnectionResolve(
  context: ApplicationContext,
  flags: RealmCliFlags & { readonly realmId?: string },
) {
  const result = await connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
  if (!result.success) {
    realmCliResultWrite(context, result)
    return undefined
  }
  return result.data
}

function realmListFlags() {
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

function realmListQueryCreate(flags: RealmListCliFlags): ListQuery | undefined {
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

function realmCliResultWrite(
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

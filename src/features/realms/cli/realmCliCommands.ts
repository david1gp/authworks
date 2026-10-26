import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { connectionProfileCliCentralFlags } from "../../connectionProfiles/cli/connectionProfileCliCentralFlags.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliSystemTokenResolve } from "../../connectionProfiles/cli/connectionProfileCliSystemTokenResolve.js"
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
    realmCliResultWrite(this, result, [connection.token])
  },
  parameters: {
    flags: {
      ...connectionProfileCliCentralFlags(),
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
    realmCliResultWrite(this, result, [connection.token])
  },
  parameters: {
    flags: {
      ...connectionProfileCliCentralFlags(),
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
    realmCliResultWrite(this, result, [connection.token])
  },
  parameters: {
    flags: {
      ...connectionProfileCliCentralFlags(),
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

type RealmAdministratorCliFlags = RealmCliFlags & {
  readonly realmId?: string
  readonly userId?: string
}

const realmAdministratorCommand = (action: "list" | "grant" | "revoke") =>
  buildCommand({
    async func(this: ApplicationContext, flags: RealmAdministratorCliFlags) {
      const connection = await realmCliConnectionResolve(this, flags)
      if (connection === undefined) return
      const realmId = scopeIdResolve(this, connection.realmId, "realm")
      if (realmId === undefined) return
      const client = realmCliClientCreate(connection)
      if (action === "list") {
        realmCliResultWrite(this, await client.realmAdministratorList(realmId), [connection.token])
        return
      }
      if (flags.userId === undefined || flags.userId.trim().length === 0) {
        this.process.stderr.write("Expected input for flag --user-id\n")
        this.process.exitCode = 1
        return
      }
      if (action === "grant")
        realmCliResultWrite(this, await client.realmAdministratorGrant(realmId, { userId: flags.userId }), [
          connection.token,
        ])
      else realmCliResultWrite(this, await client.realmAdministratorRevoke(realmId, flags.userId), [connection.token])
    },
    parameters: {
      flags: {
        ...connectionProfileCliCentralFlags(),
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
        userId: {
          brief: "User UUID",
          kind: "parsed",
          optional: true,
          parse: (value: string) => value,
          placeholder: "USER_ID",
        },
      },
    },
    docs: { brief: `Realm administrators ${action}` },
  })

const realmGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: RealmCliFlags & { readonly realmId?: string }) {
    const connection = await realmCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    const result = await realmCliClientCreate(connection).realmGet(realmId)
    realmCliResultWrite(this, result, [connection.token])
  },
  parameters: {
    flags: {
      ...connectionProfileCliCentralFlags(),
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
        brief: "System Bearer [REDACTED]",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "TOKEN",
      },
    },
  },
  docs: { brief: "Get a realm" },
})

type RealmUpdateCliFlags = RealmCliFlags & {
  readonly realmId?: string
  readonly name?: string
  readonly domain?: string
  readonly status?: "active" | "disabled"
}

const realmUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: RealmUpdateCliFlags) {
    const connection = await realmCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    const result = await realmCliClientCreate(connection).realmUpdate(realmId, {
      ...(flags.name === undefined ? {} : { name: flags.name }),
      ...(flags.domain === undefined ? {} : { domain: flags.domain }),
      ...(flags.status === undefined ? {} : { status: flags.status }),
    })
    realmCliResultWrite(this, result, [connection.token])
  },
  parameters: {
    flags: {
      ...connectionProfileCliCentralFlags(),
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
        brief: "System Bearer [REDACTED]",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "TOKEN",
      },
      name: {
        brief: "Realm display name",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "NAME",
      },
      domain: {
        brief: "Primary realm domain",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "DOMAIN",
      },
      status: {
        brief: "Realm status",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value as "active" | "disabled",
        placeholder: "STATUS",
      },
    },
  },
  docs: { brief: "Update a realm" },
})

const realmTenantGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: RealmCliFlags & { readonly realmId?: string }) {
    const connection = await realmCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    const result = await realmCliClientCreate(connection).realmTenantGet(realmId)
    realmCliResultWrite(this, result, [connection.token])
  },
  parameters: {
    flags: {
      ...connectionProfileCliCentralFlags(),
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
        brief: "Bearer [REDACTED]",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "TOKEN",
      },
    },
  },
  docs: { brief: "Get a tenant realm" },
})

const realmTenantUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: RealmUpdateCliFlags) {
    const connection = await realmCliConnectionResolve(this, flags)
    if (connection === undefined) return
    const realmId = scopeIdResolve(this, connection.realmId, "realm")
    if (realmId === undefined) return
    const result = await realmCliClientCreate(connection).realmTenantUpdate(realmId, {
      ...(flags.name === undefined ? {} : { name: flags.name }),
      ...(flags.domain === undefined ? {} : { domain: flags.domain }),
      ...(flags.status === undefined ? {} : { status: flags.status }),
    })
    realmCliResultWrite(this, result, [connection.token])
  },
  parameters: {
    flags: {
      ...connectionProfileCliCentralFlags(),
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
        brief: "Bearer [REDACTED]",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "TOKEN",
      },
      name: {
        brief: "Realm display name",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "NAME",
      },
      domain: {
        brief: "Primary realm domain",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value,
        placeholder: "DOMAIN",
      },
      status: {
        brief: "Realm status",
        kind: "parsed",
        optional: true,
        parse: (value: string) => value as "active" | "disabled",
        placeholder: "STATUS",
      },
    },
  },
  docs: { brief: "Update a tenant realm" },
})

const realmTenantAdministratorCommand = (action: "list" | "grant" | "revoke") =>
  buildCommand({
    async func(this: ApplicationContext, flags: RealmAdministratorCliFlags) {
      const connection = await realmCliConnectionResolve(this, flags)
      if (connection === undefined) return
      const realmId = scopeIdResolve(this, connection.realmId, "realm")
      if (realmId === undefined) return
      const client = realmCliClientCreate(connection)
      if (action === "list") {
        realmCliResultWrite(this, await client.realmTenantAdministratorList(realmId), [connection.token])
        return
      }
      if (flags.userId === undefined || flags.userId.trim().length === 0) {
        this.process.stderr.write("Expected input for flag --user-id\n")
        this.process.exitCode = 1
        return
      }
      if (action === "grant")
        realmCliResultWrite(this, await client.realmTenantAdministratorGrant(realmId, { userId: flags.userId }), [
          connection.token,
        ])
      else
        realmCliResultWrite(this, await client.realmTenantAdministratorRevoke(realmId, flags.userId), [
          connection.token,
        ])
    },
    parameters: {
      flags: {
        ...connectionProfileCliCentralFlags(),
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
          brief: "Bearer [REDACTED]",
          kind: "parsed",
          optional: true,
          parse: (value: string) => value,
          placeholder: "TOKEN",
        },
        userId: {
          brief: "User UUID",
          kind: "parsed",
          optional: true,
          parse: (value: string) => value,
          placeholder: "USER_ID",
        },
      },
    },
    docs: { brief: `Tenant realm administrators ${action}` },
  })

export const realmCliCommands = buildRouteMap({
  routes: {
    administrators: buildRouteMap({
      docs: { brief: "Realm administrators" },
      routes: {
        grant: realmAdministratorCommand("grant"),
        list: realmAdministratorCommand("list"),
        revoke: realmAdministratorCommand("revoke"),
      },
    }),
    bootstrapAdmin: realmBootstrapCommand,
    create: realmCreateCommand,
    get: realmGetCommand,
    list: realmListCommand,
    tenantAdministratorGrant: realmTenantAdministratorCommand("grant"),
    tenantAdministratorList: realmTenantAdministratorCommand("list"),
    tenantAdministratorRevoke: realmTenantAdministratorCommand("revoke"),
    tenantGet: realmTenantGetCommand,
    tenantUpdate: realmTenantUpdateCommand,
    update: realmUpdateCommand,
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
    realmCliResultWrite(context, result, [flags.token, context.process.env?.AUTHWORKS_TOKEN])
    return undefined
  }
  return { ...result.data, token: connectionProfileCliSystemTokenResolve(flags.token, context.process.env) }
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

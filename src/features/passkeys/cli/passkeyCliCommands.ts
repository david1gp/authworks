import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliProfileFlag } from "../../connectionProfiles/cli/connectionProfileCliProfileFlag.js"
import { passkeyApiClientCreate } from "../client/passkeyApiClientCreate.js"

type PasskeyListFlags = {
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}
type PasskeyCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly token?: string
  readonly realmId?: string
}

const passkeyListCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & PasskeyListFlags) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    passkeyResultWrite(
      this,
      await passkeyClientCreate(connection.data).passkeyCredentialList(realmId, passkeyListQueryCreate(flags)),
      [connection.data.token],
    )
  },
  parameters: { flags: { ...passkeyCommonFlags(), ...passkeyListFlags(), realmId: passkeyRealmIdFlag() } },
  docs: { brief: "List passkey credentials" },
})

const passkeyRevokeCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & { credentialId: string }) {
    const connection = await passkeyCliConnectionResolve(this, flags)
    if (!connection.success) {
      passkeyResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    passkeyResultWrite(
      this,
      await passkeyClientCreate(connection.data).passkeyCredentialRevoke(realmId, {
        credentialId: flags.credentialId,
      }),
      [connection.data.token],
    )
  },
  parameters: {
    flags: {
      ...passkeyCommonFlags(),
      realmId: passkeyRealmIdFlag(),
      credentialId: passkeyTextFlag("Credential ID"),
    },
  },
  docs: { brief: "Revoke a passkey credential" },
})

export const passkeyCliCommands = buildRouteMap({
  routes: { list: passkeyListCommand, revoke: passkeyRevokeCommand },
  docs: { brief: "Manage passkey credentials" },
})

async function passkeyCliConnectionResolve(context: ApplicationContext, flags: PasskeyCliFlags) {
  return connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
}

function passkeyClientCreate(flags: { readonly server: string; readonly token?: string }) {
  return passkeyApiClientCreate({
    baseUrl: flags.server,
    token: flags.token,
  })
}

function passkeyResultWrite(
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

function passkeyCommonFlags() {
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
  }
}

function passkeyListFlags() {
  return {
    pageSize: {
      brief: "Page size",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => Number(value),
      placeholder: "NUMBER",
    },
    pageToken: {
      brief: "Page token",
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

function passkeyListQueryCreate(flags: PasskeyCliFlags & PasskeyListFlags) {
  return {
    ...(flags.pageSize === undefined ? {} : { pageSize: flags.pageSize }),
    ...(flags.pageToken === undefined ? {} : { pageToken: flags.pageToken }),
    ...(flags.sortBy === undefined ? {} : { sortBy: flags.sortBy }),
    ...(flags.sortDirection === undefined ? {} : { sortDirection: flags.sortDirection }),
  }
}

function passkeyRealmIdFlag() {
  return {
    brief: "Realm UUID",
    kind: "parsed" as const,
    optional: true as const,
    parse: (value: string) => value,
    placeholder: "REALM_ID",
  }
}

function passkeyTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

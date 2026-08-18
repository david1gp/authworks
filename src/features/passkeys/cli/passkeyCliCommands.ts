import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { passkeyApiClientCreate } from "../client/passkeyApiClientCreate.js"

type PasskeyListFlags = {
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}
type PasskeyCliFlags = {
  readonly server?: string
  readonly token?: string
  readonly realmId?: string
}

const passkeyListCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & PasskeyListFlags) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    passkeyResultWrite(
      this,
      await passkeyClientCreate(this, flags).passkeyCredentialList(realmId, passkeyListQueryCreate(flags)),
    )
  },
  parameters: { flags: { ...passkeyCommonFlags(), ...passkeyListFlags(), realmId: passkeyRealmIdFlag() } },
  docs: { brief: "List passkey credentials" },
})

const passkeyRevokeCommand = buildCommand({
  async func(this: ApplicationContext, flags: PasskeyCliFlags & { credentialId: string }) {
    const realmId = scopeIdResolve(this, flags.realmId, "realm")
    if (realmId === undefined) return
    passkeyResultWrite(
      this,
      await passkeyClientCreate(this, flags).passkeyCredentialRevoke(realmId, {
        credentialId: flags.credentialId,
      }),
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

function passkeyClientCreate(context: ApplicationContext, flags: PasskeyCliFlags) {
  return passkeyApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.ZITADEL_V2_TOKEN,
  })
}

function passkeyResultWrite(
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

function passkeyCommonFlags() {
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

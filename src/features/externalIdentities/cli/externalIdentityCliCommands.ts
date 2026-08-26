import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliProfileFlag } from "../../connectionProfiles/cli/connectionProfileCliProfileFlag.js"
import { connectionProfileCliSystemTokenResolve } from "../../connectionProfiles/cli/connectionProfileCliSystemTokenResolve.js"
import { externalIdentityApiClientCreate } from "../client/externalIdentityApiClientCreate.js"
import type { ExternalIdentityProviderType } from "../public/externalIdentityProviderTypeSchema.js"

type ExternalIdentityListFlags = {
  readonly pageSize?: number
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}
type ExternalIdentityCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly systemToken?: string
  readonly token?: string
  readonly realmId?: string
}

const externalIdentityProviderCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ExternalIdentityCliFlags & {
      clientId: string
      clientSecret: string
      displayName: string
      redirectUri: string
      type: string
      allowAccountCreation?: boolean
      organizationId?: string
      scopes?: string
    },
  ) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    const result = await externalIdentityCliClientCreate(resolved.connection).externalIdentityProviderCreate(
      resolved.realmId,
      {
        allowAccountCreation: flags.allowAccountCreation ?? false,
        clientId: flags.clientId,
        clientSecret: flags.clientSecret,
        displayName: flags.displayName,
        organizationId: resolved.organizationId,
        redirectUri: flags.redirectUri,
        scopes: flags.scopes?.split(" "),
        type: flags.type as ExternalIdentityProviderType,
      },
    )
    externalIdentityCliResultWrite(this, result, [resolved.connection.token, resolved.connection.systemToken])
  },
  parameters: {
    flags: {
      ...externalIdentityCommonFlags(),
      allowAccountCreation: { brief: "Allow new accounts", kind: "boolean" as const, optional: true as const },
      clientId: externalIdentityTextFlag("OAuth client ID"),
      clientSecret: externalIdentityTextFlag("OAuth client secret"),
      displayName: externalIdentityTextFlag("Provider display name"),
      organizationId: externalIdentityOptionalTextFlag("Organization UUID"),
      redirectUri: externalIdentityTextFlag("Registered callback URI"),
      scopes: externalIdentityOptionalTextFlag("Space-separated scopes"),
      type: externalIdentityTextFlag("google, github, or microsoft"),
    },
  },
  docs: { brief: "Configure an external identity provider" },
})

const externalIdentityProviderListCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ExternalIdentityCliFlags & ExternalIdentityListFlags & { organizationId?: string },
  ) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(resolved.connection).externalIdentityProviderList(
        resolved.realmId,
        resolved.organizationId,
        externalIdentityListQueryCreate(flags),
      ),
      [resolved.connection.token, resolved.connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...externalIdentityCommonFlags(),
      ...externalIdentityListFlags(),
      organizationId: externalIdentityOptionalTextFlag("Organization UUID"),
    },
  },
  docs: { brief: "List external identity providers" },
})

const externalIdentityProviderDisableCommand = buildCommand({
  async func(this: ApplicationContext, flags: ExternalIdentityCliFlags & { providerId: string }) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(resolved.connection).externalIdentityProviderDisable(
        resolved.realmId,
        flags.providerId,
      ),
      [resolved.connection.token, resolved.connection.systemToken],
    )
  },
  parameters: { flags: { ...externalIdentityCommonFlags(), providerId: externalIdentityTextFlag("Provider UUID") } },
  docs: { brief: "Disable an external identity provider" },
})

const externalIdentityStartCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ExternalIdentityCliFlags & { providerId: string; organizationId?: string },
  ) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(resolved.connection).externalIdentityStart(
        resolved.realmId,
        flags.providerId,
        {
          organizationId: resolved.organizationId,
        },
      ),
      [resolved.connection.token, resolved.connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...externalIdentityCommonFlags(),
      organizationId: externalIdentityOptionalTextFlag("Organization UUID"),
      providerId: externalIdentityTextFlag("Provider UUID"),
    },
  },
  docs: { brief: "Start external identity authentication" },
})

export const externalIdentityCliCommands = buildRouteMap({
  routes: {
    disable: externalIdentityProviderDisableCommand,
    list: externalIdentityProviderListCommand,
    providerCreate: externalIdentityProviderCreateCommand,
    start: externalIdentityStartCommand,
  },
  docs: { brief: "External identities and provider configuration" },
})

async function externalIdentityCliConnectionResolve(
  context: ApplicationContext,
  flags: ExternalIdentityCliFlags & { readonly organizationId?: string },
) {
  const result = await connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
  if (!result.success) {
    externalIdentityCliResultWrite(context, result, [
      flags.systemToken,
      flags.token,
      context.process.env?.AUTHWORKS_SYSTEM_SECRET,
      context.process.env?.AUTHWORKS_TOKEN,
    ])
    return undefined
  }
  const realmId = scopeIdResolve(context, result.data.realmId, "realm")
  if (realmId === undefined) return undefined
  const organizationId = scopeIdResolve(context, result.data.organizationId, "organization", false)
  return {
    connection: {
      ...result.data,
      systemToken: connectionProfileCliSystemTokenResolve(flags.systemToken ?? flags.token, context.process.env),
    },
    organizationId,
    realmId,
  }
}

function externalIdentityCliClientCreate(connection: {
  readonly server: string
  readonly systemToken?: string
  readonly token?: string
}) {
  return externalIdentityApiClientCreate({
    baseUrl: connection.server,
    systemToken: connection.systemToken,
    token: connection.token,
  })
}

function externalIdentityCliResultWrite(
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

function externalIdentityCommonFlags() {
  return {
    profile: connectionProfileCliProfileFlag(),
    realmId: { ...externalIdentityTextFlag("Realm UUID"), optional: true as const },
    server: {
      brief: "Authworks server URL",
      kind: "parsed" as const,
      optional: true as const,
      parse: (value: string) => value,
      placeholder: "URL",
    },
    token: {
      brief: "System or session bearer token",
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

function externalIdentityListFlags() {
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

function externalIdentityListQueryCreate(flags: ExternalIdentityCliFlags & ExternalIdentityListFlags) {
  return {
    ...(flags.pageSize === undefined ? {} : { pageSize: flags.pageSize }),
    ...(flags.pageToken === undefined ? {} : { pageToken: flags.pageToken }),
    ...(flags.sortBy === undefined ? {} : { sortBy: flags.sortBy }),
    ...(flags.sortDirection === undefined ? {} : { sortDirection: flags.sortDirection }),
  }
}

function externalIdentityTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function externalIdentityOptionalTextFlag(brief: string) {
  return { ...externalIdentityTextFlag(brief), optional: true as const }
}

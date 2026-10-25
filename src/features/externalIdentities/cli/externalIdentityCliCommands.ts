import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import { connectionProfileCliCentralFlags } from "../../connectionProfiles/cli/connectionProfileCliCentralFlags.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
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

const externalIdentityProviderUpdateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ExternalIdentityCliFlags & {
      providerId: string
      allowAccountCreation?: boolean
      clientId?: string
      clientSecret?: string
      displayName?: string
      enabled?: boolean
      redirectUri?: string
      scopes?: string
    },
  ) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(resolved.connection).externalIdentityProviderUpdate(
        resolved.realmId,
        flags.providerId,
        {
          ...(flags.allowAccountCreation === undefined ? {} : { allowAccountCreation: flags.allowAccountCreation }),
          ...(flags.clientId === undefined ? {} : { clientId: flags.clientId }),
          ...(flags.clientSecret === undefined ? {} : { clientSecret: flags.clientSecret }),
          ...(flags.displayName === undefined ? {} : { displayName: flags.displayName }),
          ...(flags.enabled === undefined ? {} : { enabled: flags.enabled }),
          ...(flags.redirectUri === undefined ? {} : { redirectUri: flags.redirectUri }),
          ...(flags.scopes === undefined ? {} : { scopes: flags.scopes.split(" ") }),
        },
      ),
      [resolved.connection.token, resolved.connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...externalIdentityCommonFlags(),
      providerId: externalIdentityTextFlag("Provider UUID"),
      allowAccountCreation: externalIdentityOptionalBooleanFlag("Allow new accounts"),
      clientId: externalIdentityOptionalTextFlag("OAuth client ID"),
      clientSecret: externalIdentityOptionalTextFlag("OAuth client secret"),
      displayName: externalIdentityOptionalTextFlag("Provider display name"),
      enabled: externalIdentityOptionalBooleanFlag("Enable the provider"),
      redirectUri: externalIdentityOptionalTextFlag("Registered callback URI"),
      scopes: externalIdentityOptionalTextFlag("Space-separated scopes"),
    },
  },
  docs: { brief: "Update an external identity provider" },
})

const externalIdentityProviderPublicListCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ExternalIdentityCliFlags & ExternalIdentityListFlags & { organizationId?: string },
  ) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(resolved.connection).externalIdentityProviderPublicList(
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
  docs: { brief: "List public external identity providers" },
})

const externalIdentityProviderMeListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ExternalIdentityCliFlags & ExternalIdentityListFlags) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(resolved.connection).externalIdentityProviderMeList(
        resolved.realmId,
        externalIdentityListQueryCreate(flags),
      ),
      [resolved.connection.token, resolved.connection.systemToken],
    )
  },
  parameters: { flags: { ...externalIdentityCommonFlags(), ...externalIdentityListFlags() } },
  docs: { brief: "List external identity providers for the current session" },
})

const externalIdentityLinkStartCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ExternalIdentityCliFlags & { providerId: string; userId: string; organizationId?: string },
  ) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(resolved.connection).externalIdentityLinkStart(
        resolved.realmId,
        flags.userId,
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
      userId: externalIdentityUserIdFlag(),
    },
  },
  docs: { brief: "Start linking an external identity to a user" },
})

const externalIdentityLinkCompleteCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ExternalIdentityCliFlags & { confirmationToken: string; providerId: string; userId: string },
  ) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(resolved.connection).externalIdentityLinkComplete(
        resolved.realmId,
        flags.userId,
        flags.providerId,
        {
          confirm: true,
          confirmationToken: flags.confirmationToken,
        },
      ),
      [flags.confirmationToken, resolved.connection.token, resolved.connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...externalIdentityCommonFlags(),
      confirmationToken: externalIdentityTextFlag("Link confirmation token"),
      providerId: externalIdentityTextFlag("Provider UUID"),
      userId: externalIdentityUserIdFlag(),
    },
  },
  docs: { brief: "Complete linking an external identity to a user" },
})

const externalIdentityUnlinkCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ExternalIdentityCliFlags & { externalSubject: string; providerId: string; userId: string },
  ) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(resolved.connection).externalIdentityUnlink(
        resolved.realmId,
        flags.userId,
        flags.providerId,
        flags.externalSubject,
      ),
      [resolved.connection.token, resolved.connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...externalIdentityCommonFlags(),
      externalSubject: externalIdentityTextFlag("External subject identifier"),
      providerId: externalIdentityTextFlag("Provider UUID"),
      userId: externalIdentityUserIdFlag(),
    },
  },
  docs: { brief: "Unlink an external identity from a user" },
})

const externalIdentityMeListCommand = buildCommand({
  async func(this: ApplicationContext, flags: ExternalIdentityCliFlags & ExternalIdentityListFlags) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(resolved.connection).externalIdentityMeList(
        resolved.realmId,
        externalIdentityListQueryCreate(flags),
      ),
      [resolved.connection.token, resolved.connection.systemToken],
    )
  },
  parameters: { flags: { ...externalIdentityCommonFlags(), ...externalIdentityListFlags() } },
  docs: { brief: "List the current session external identities" },
})

const externalIdentityMeLinkStartCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ExternalIdentityCliFlags & { providerId: string; organizationId?: string },
  ) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(resolved.connection).externalIdentityMeLinkStart(
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
  docs: { brief: "Start linking an external identity to the current session" },
})

const externalIdentityMeLinkCompleteCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ExternalIdentityCliFlags & { confirmationToken: string; providerId: string },
  ) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(resolved.connection).externalIdentityMeLinkComplete(
        resolved.realmId,
        flags.providerId,
        {
          confirm: true,
          confirmationToken: flags.confirmationToken,
        },
      ),
      [flags.confirmationToken, resolved.connection.token, resolved.connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...externalIdentityCommonFlags(),
      confirmationToken: externalIdentityTextFlag("Link confirmation token"),
      providerId: externalIdentityTextFlag("Provider UUID"),
    },
  },
  docs: { brief: "Complete linking an external identity to the current session" },
})

const externalIdentityMeUnlinkCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: ExternalIdentityCliFlags & { externalSubject: string; providerId: string },
  ) {
    const resolved = await externalIdentityCliConnectionResolve(this, flags)
    if (resolved === undefined) return
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(resolved.connection).externalIdentityMeUnlink(
        resolved.realmId,
        flags.providerId,
        flags.externalSubject,
      ),
      [resolved.connection.token, resolved.connection.systemToken],
    )
  },
  parameters: {
    flags: {
      ...externalIdentityCommonFlags(),
      externalSubject: externalIdentityTextFlag("External subject identifier"),
      providerId: externalIdentityTextFlag("Provider UUID"),
    },
  },
  docs: { brief: "Unlink an external identity from the current session" },
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
    linkComplete: externalIdentityLinkCompleteCommand,
    linkStart: externalIdentityLinkStartCommand,
    list: externalIdentityProviderListCommand,
    meLinkComplete: externalIdentityMeLinkCompleteCommand,
    meLinkStart: externalIdentityMeLinkStartCommand,
    meList: externalIdentityMeListCommand,
    meUnlink: externalIdentityMeUnlinkCommand,
    providerCreate: externalIdentityProviderCreateCommand,
    providerMeList: externalIdentityProviderMeListCommand,
    providerPublicList: externalIdentityProviderPublicListCommand,
    providerUpdate: externalIdentityProviderUpdateCommand,
    start: externalIdentityStartCommand,
    unlink: externalIdentityUnlinkCommand,
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
    ...connectionProfileCliCentralFlags(),
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

function externalIdentityUserIdFlag() {
  return { brief: "User UUID", kind: "parsed" as const, parse: (value: string) => value, placeholder: "USER_ID" }
}

function externalIdentityTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function externalIdentityOptionalBooleanFlag(brief: string) {
  return { brief, kind: "boolean" as const, optional: true as const }
}

function externalIdentityOptionalTextFlag(brief: string) {
  return { ...externalIdentityTextFlag(brief), optional: true as const }
}

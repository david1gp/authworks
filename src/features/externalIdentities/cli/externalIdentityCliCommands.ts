import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { externalIdentityApiClientCreate } from "../client/externalIdentityApiClientCreate.js"
import type { ExternalIdentityProviderType } from "../public/externalIdentityProviderTypeSchema.js"

type ExternalIdentityCliFlags = {
  readonly server?: string
  readonly token?: string
  readonly realmId: string
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
    const result = await externalIdentityCliClientCreate(this, flags).externalIdentityProviderCreate(flags.realmId, {
      allowAccountCreation: flags.allowAccountCreation ?? false,
      clientId: flags.clientId,
      clientSecret: flags.clientSecret,
      displayName: flags.displayName,
      organizationId: flags.organizationId,
      redirectUri: flags.redirectUri,
      scopes: flags.scopes?.split(" "),
      type: flags.type as ExternalIdentityProviderType,
    })
    externalIdentityCliResultWrite(this, result)
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
  async func(this: ApplicationContext, flags: ExternalIdentityCliFlags & { organizationId?: string }) {
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(this, flags).externalIdentityProviderList(
        flags.realmId,
        flags.organizationId,
      ),
    )
  },
  parameters: {
    flags: { ...externalIdentityCommonFlags(), organizationId: externalIdentityOptionalTextFlag("Organization UUID") },
  },
  docs: { brief: "List external identity providers" },
})

const externalIdentityProviderDisableCommand = buildCommand({
  async func(this: ApplicationContext, flags: ExternalIdentityCliFlags & { providerId: string }) {
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(this, flags).externalIdentityProviderDisable(
        flags.realmId,
        flags.providerId,
      ),
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
    externalIdentityCliResultWrite(
      this,
      await externalIdentityCliClientCreate(this, flags).externalIdentityStart(flags.realmId, flags.providerId, {
        organizationId: flags.organizationId,
      }),
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

function externalIdentityCliClientCreate(
  context: ApplicationContext,
  flags: Pick<ExternalIdentityCliFlags, "server" | "token">,
) {
  return externalIdentityApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.ZITADEL_V2_TOKEN,
  })
}

function externalIdentityCliResultWrite(
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

function externalIdentityCommonFlags() {
  return {
    realmId: externalIdentityTextFlag("Realm UUID"),
    server: {
      brief: "ZITADEL v2 server URL",
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
  }
}

function externalIdentityTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function externalIdentityOptionalTextFlag(brief: string) {
  return { ...externalIdentityTextFlag(brief), optional: true as const }
}

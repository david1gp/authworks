import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"

type OidcCliFlags = { readonly server?: string; readonly token?: string }
type OidcRealmFlags = OidcCliFlags & { readonly realmId: string }
type OidcClientFlags = OidcRealmFlags & { readonly clientId: string }
type OidcConsentFlags = OidcRealmFlags & { readonly userId: string }

const oidcClientCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: OidcRealmFlags & {
      name: string
      clientType: "public" | "confidential"
      redirectUris: string
      postLogoutRedirectUris?: string
      allowedScopes?: string
      trusted?: boolean
      requireConsent?: boolean
    },
  ) {
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(this, flags).oidcClientCreate(flags.realmId, {
        allowedScopes: splitValues(flags.allowedScopes, ["openid"]),
        clientType: flags.clientType,
        name: flags.name,
        postLogoutRedirectUris: splitValues(flags.postLogoutRedirectUris, []),
        redirectUris: splitValues(flags.redirectUris, []),
        requireConsent: flags.requireConsent,
        trusted: flags.trusted,
      }),
    )
  },
  parameters: {
    flags: {
      ...oidcCommonFlags(),
      realmId: oidcIdFlag("Realm UUID"),
      name: oidcTextFlag("Client display name"),
      clientType: {
        brief: "Client type",
        kind: "parsed",
        parse: (value: string) => value as "public" | "confidential",
        placeholder: "TYPE",
      },
      redirectUris: oidcTextFlag("Comma-separated exact redirect URIs"),
      postLogoutRedirectUris: { ...oidcTextFlag("Comma-separated post-logout redirect URIs"), optional: true as const },
      allowedScopes: { ...oidcTextFlag("Comma-separated allowed scopes"), optional: true as const },
      trusted: { brief: "Skip consent for this client", kind: "boolean" as const, optional: true as const },
      requireConsent: { brief: "Require consent", kind: "boolean" as const, optional: true as const },
    },
  },
  docs: { brief: "Create an OIDC client" },
})

const oidcClientListCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcRealmFlags) {
    oidcCliResultWrite(this, await oidcCliClientCreate(this, flags).oidcClientList(flags.realmId))
  },
  parameters: { flags: { ...oidcCommonFlags(), realmId: oidcIdFlag("Realm UUID") } },
  docs: { brief: "List OIDC clients" },
})

const oidcClientGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcClientFlags) {
    oidcCliResultWrite(this, await oidcCliClientCreate(this, flags).oidcClientGet(flags.realmId, flags.clientId))
  },
  parameters: {
    flags: { ...oidcCommonFlags(), realmId: oidcIdFlag("Realm UUID"), clientId: oidcIdFlag("Client UUID") },
  },
  docs: { brief: "Get an OIDC client" },
})

const oidcClientSecretRotateCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcClientFlags) {
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(this, flags).oidcClientSecretRotate(flags.realmId, flags.clientId),
    )
  },
  parameters: {
    flags: { ...oidcCommonFlags(), realmId: oidcIdFlag("Realm UUID"), clientId: oidcIdFlag("Client UUID") },
  },
  docs: { brief: "Rotate an OIDC client secret" },
})

const oidcSigningKeyCreateCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcRealmFlags) {
    oidcCliResultWrite(this, await oidcCliClientCreate(this, flags).oidcSigningKeyCreate(flags.realmId))
  },
  parameters: { flags: { ...oidcCommonFlags(), realmId: oidcIdFlag("Realm UUID") } },
  docs: { brief: "Create and activate an OIDC signing key" },
})

const oidcSigningKeyListCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcRealmFlags) {
    oidcCliResultWrite(this, await oidcCliClientCreate(this, flags).oidcSigningKeyList(flags.realmId))
  },
  parameters: { flags: { ...oidcCommonFlags(), realmId: oidcIdFlag("Realm UUID") } },
  docs: { brief: "List OIDC signing keys" },
})

const oidcSigningKeyRetireCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcRealmFlags & { signingKeyId: string }) {
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(this, flags).oidcSigningKeyLifecycleSet(flags.realmId, flags.signingKeyId, {
        status: "retired",
      }),
    )
  },
  parameters: {
    flags: {
      ...oidcCommonFlags(),
      realmId: oidcIdFlag("Realm UUID"),
      signingKeyId: oidcIdFlag("Signing key UUID"),
    },
  },
  docs: { brief: "Retire an OIDC signing key" },
})

const oidcConsentListCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcConsentFlags) {
    oidcCliResultWrite(this, await oidcCliClientCreate(this, flags).oidcConsentList(flags.realmId, flags.userId))
  },
  parameters: {
    flags: { ...oidcCommonFlags(), realmId: oidcIdFlag("Realm UUID"), userId: oidcIdFlag("User UUID") },
  },
  docs: { brief: "List persisted OIDC consents" },
})

const oidcConsentRevokeCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcConsentFlags & { clientId: string }) {
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(this, flags).oidcConsentRevoke(flags.realmId, flags.userId, {
        client_id: flags.clientId,
      }),
    )
  },
  parameters: {
    flags: {
      ...oidcCommonFlags(),
      realmId: oidcIdFlag("Realm UUID"),
      userId: oidcIdFlag("User UUID"),
      clientId: oidcIdFlag("Client UUID"),
    },
  },
  docs: { brief: "Revoke a persisted OIDC consent" },
})

const oidcLogoutCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: OidcCliFlags & {
      clientId?: string
      idTokenHint?: string
      postLogoutRedirectUri?: string
      state?: string
    },
  ) {
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(this, flags).oidcLogout({
        ...(flags.clientId === undefined ? {} : { client_id: flags.clientId }),
        ...(flags.idTokenHint === undefined ? {} : { id_token_hint: flags.idTokenHint }),
        ...(flags.postLogoutRedirectUri === undefined ? {} : { post_logout_redirect_uri: flags.postLogoutRedirectUri }),
        ...(flags.state === undefined ? {} : { state: flags.state }),
      }),
    )
  },
  parameters: {
    flags: {
      ...oidcCommonFlags(),
      clientId: { ...oidcIdFlag("Client UUID"), optional: true as const },
      idTokenHint: { ...oidcTextFlag("ID token hint"), optional: true as const },
      postLogoutRedirectUri: { ...oidcTextFlag("Exact registered post-logout redirect URI"), optional: true as const },
      state: { ...oidcTextFlag("Post-logout state"), optional: true as const },
    },
  },
  docs: { brief: "Perform RP-initiated OIDC logout" },
})

export const oidcCliCommands = buildRouteMap({
  routes: {
    clientCreate: oidcClientCreateCommand,
    clientGet: oidcClientGetCommand,
    clientList: oidcClientListCommand,
    clientSecretRotate: oidcClientSecretRotateCommand,
    keyCreate: oidcSigningKeyCreateCommand,
    keyList: oidcSigningKeyListCommand,
    keyRetire: oidcSigningKeyRetireCommand,
    consentList: oidcConsentListCommand,
    consentRevoke: oidcConsentRevokeCommand,
    logout: oidcLogoutCommand,
  },
  docs: { brief: "OIDC client and signing-key administration" },
})

function oidcCliClientCreate(context: ApplicationContext, flags: OidcCliFlags) {
  return oidcApiClientCreate({
    baseUrl: flags.server ?? context.process.env?.ZITADEL_V2_URL ?? "http://127.0.0.1:3000",
    token: flags.token ?? context.process.env?.ZITADEL_V2_TOKEN,
  })
}

function oidcCliResultWrite(
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

function oidcCommonFlags() {
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

function oidcIdFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "UUID" }
}

function oidcTextFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "VALUE" }
}

function splitValues(value: string | undefined, fallback: string[]): string[] {
  if (value === undefined) return fallback
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

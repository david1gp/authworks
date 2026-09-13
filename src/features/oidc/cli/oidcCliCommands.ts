import { type ApplicationContext, buildCommand, buildRouteMap } from "@stricli/core"
import { scopeIdResolve } from "../../../platform/cli/scopeIdResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { connectionProfileCliCentralFlags } from "../../connectionProfiles/cli/connectionProfileCliCentralFlags.js"
import { connectionProfileCliConnectionResolve } from "../../connectionProfiles/cli/connectionProfileCliConnectionResolve.js"
import { connectionProfileCliOutputRedact } from "../../connectionProfiles/cli/connectionProfileCliOutputRedact.js"
import { connectionProfileCliSystemTokenResolve } from "../../connectionProfiles/cli/connectionProfileCliSystemTokenResolve.js"
import { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import { oidcCodelineClientEnsure } from "./oidcCodelineClientEnsure.js"
import { oidcCodelineProductionClientEnsure } from "./oidcCodelineProductionClientEnsure.js"
import { oidcCodelineProductionOrganizationIdGet } from "./oidcCodelineProductionOrganizationIdGet.js"
import { oidcCodelineProductionOrganizationIdGetExitCodeGet } from "./oidcCodelineProductionOrganizationIdGetExitCodeGet.js"
import { oidcCodelineProductionOrganizationIdGetFailureOutputCreate } from "./oidcCodelineProductionOrganizationIdGetFailureOutputCreate.js"
import { oidcCodelineProductionSecretRotate } from "./oidcCodelineProductionSecretRotate.js"
import { oidcCodelineSecretRotateExitCodeGet } from "./oidcCodelineSecretRotateExitCodeGet.js"
import { oidcCodelineSecretRotateFailureOutputCreate } from "./oidcCodelineSecretRotateFailureOutputCreate.js"
import { oidcMultichatDevelopmentClientEnsure } from "./oidcMultichatDevelopmentClientEnsure.js"
import { oidcMultichatDevelopmentSecretRotate } from "./oidcMultichatDevelopmentSecretRotate.js"
import { oidcMultichatProductionClientEnsure } from "./oidcMultichatProductionClientEnsure.js"
import { oidcMultichatProductionOrganizationIdGet } from "./oidcMultichatProductionOrganizationIdGet.js"
import { oidcMultichatProductionSecretRotate } from "./oidcMultichatProductionSecretRotate.js"
import { oidcProductionSigningKeyEnsure } from "./oidcProductionSigningKeyEnsure.js"
import { oidcProductionSigningKeyEnsureExitCodeGet } from "./oidcProductionSigningKeyEnsureExitCodeGet.js"
import { oidcProductionSigningKeyEnsureFailureOutputCreate } from "./oidcProductionSigningKeyEnsureFailureOutputCreate.js"

type OidcCliFlags = {
  readonly profile?: string
  readonly server?: string
  readonly systemToken?: string
  readonly token?: string
}
type OidcListCliFlags = OidcCliFlags & {
  readonly pageSize?: string
  readonly pageToken?: string
  readonly sortBy?: string
  readonly sortDirection?: "asc" | "desc"
}
type OidcRealmFlags = OidcCliFlags & { readonly realmId?: string }
type OidcListRealmFlags = OidcListCliFlags & { readonly realmId?: string }
type OidcClientFlags = OidcRealmFlags & { readonly clientId: string }
type OidcClientGetFlags = OidcClientFlags & { readonly ifModifiedSince?: string }
type OidcClientUpdateFlags = OidcClientFlags & {
  readonly accessTokenRoleAssertion?: boolean
  readonly additionalOrigins?: string
  readonly allowedScopes?: string
  readonly idTokenUserinfoAssertion?: boolean
  readonly name?: string
  readonly postLogoutRedirectUris?: string
  readonly redirectUris?: string
  readonly requireConsent?: boolean
  readonly trusted?: boolean
}
type OidcConsentFlags = OidcRealmFlags & { readonly userId: string }
type OidcConsentListFlags = OidcListRealmFlags & { readonly userId: string }
type OidcCodelineClientEnsureFlags = OidcRealmFlags & {
  readonly clientId?: string
  readonly envFile?: string
  readonly name?: string
}

const oidcClientCreateCommand = buildCommand({
  async func(
    this: ApplicationContext,
    flags: OidcRealmFlags & {
      name: string
      clientType: "public" | "confidential"
      redirectUris: string
      postLogoutRedirectUris?: string
      allowedScopes?: string
      accessTokenRoleAssertion?: boolean
      additionalOrigins?: string
      idTokenUserinfoAssertion?: boolean
      trusted?: boolean
      requireConsent?: boolean
    },
  ) {
    const connection = await oidcCliConnectionResolve(this, flags)
    if (!connection.success) {
      oidcCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(connection.data).oidcClientCreate(realmId, {
        allowedScopes: splitValues(flags.allowedScopes, ["openid"]),
        clientType: flags.clientType,
        name: flags.name,
        postLogoutRedirectUris: splitValues(flags.postLogoutRedirectUris, []),
        redirectUris: splitValues(flags.redirectUris, []),
        accessTokenRoleAssertion: flags.accessTokenRoleAssertion,
        additionalOrigins: splitValues(flags.additionalOrigins, []),
        idTokenUserinfoAssertion: flags.idTokenUserinfoAssertion,
        requireConsent: flags.requireConsent,
        trusted: flags.trusted,
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...oidcCommonFlags(),
      realmId: oidcRealmIdFlag(),
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
      accessTokenRoleAssertion: {
        brief: "Include project roles in access tokens",
        kind: "boolean" as const,
        optional: true as const,
      },
      additionalOrigins: { ...oidcTextFlag("Comma-separated additional browser origins"), optional: true as const },
      idTokenUserinfoAssertion: {
        brief: "Include scoped claims from UserInfo in ID tokens",
        kind: "boolean" as const,
        optional: true as const,
      },
      trusted: { brief: "Skip consent for this client", kind: "boolean" as const, optional: true as const },
      requireConsent: { brief: "Require consent", kind: "boolean" as const, optional: true as const },
    },
  },
  docs: { brief: "Create an OIDC client" },
})

const oidcClientListCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcListRealmFlags) {
    const connection = await oidcCliConnectionResolve(this, flags)
    if (!connection.success) {
      oidcCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(connection.data).oidcClientList(realmId, oidcListQueryCreate(flags)),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: { flags: { ...oidcCommonFlags(), ...oidcListFlags(), realmId: oidcRealmIdFlag() } },
  docs: { brief: "List OIDC clients" },
})

const oidcClientGetCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcClientGetFlags) {
    const connection = await oidcCliConnectionResolve(this, flags)
    if (!connection.success) {
      oidcCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(connection.data).oidcClientGet(
        realmId,
        flags.clientId,
        flags.ifModifiedSince === undefined ? undefined : { ifModifiedSince: flags.ifModifiedSince },
      ),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...oidcCommonFlags(),
      realmId: oidcRealmIdFlag(),
      clientId: oidcIdFlag("Client UUID"),
      ifModifiedSince: ifModifiedSinceFlag(),
    },
  },
  docs: { brief: "Get an OIDC client" },
})

const oidcClientUpdateCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcClientUpdateFlags) {
    const connection = await oidcCliConnectionResolve(this, flags)
    if (!connection.success) {
      oidcCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(connection.data).oidcClientUpdate(realmId, flags.clientId, {
        ...(flags.accessTokenRoleAssertion === undefined
          ? {}
          : { accessTokenRoleAssertion: flags.accessTokenRoleAssertion }),
        ...(flags.additionalOrigins === undefined
          ? {}
          : { additionalOrigins: splitValues(flags.additionalOrigins, []) }),
        ...(flags.allowedScopes === undefined ? {} : { allowedScopes: splitValues(flags.allowedScopes, []) }),
        ...(flags.idTokenUserinfoAssertion === undefined
          ? {}
          : { idTokenUserinfoAssertion: flags.idTokenUserinfoAssertion }),
        ...(flags.name === undefined ? {} : { name: flags.name }),
        ...(flags.postLogoutRedirectUris === undefined
          ? {}
          : { postLogoutRedirectUris: splitValues(flags.postLogoutRedirectUris, []) }),
        ...(flags.redirectUris === undefined ? {} : { redirectUris: splitValues(flags.redirectUris, []) }),
        ...(flags.requireConsent === undefined ? {} : { requireConsent: flags.requireConsent }),
        ...(flags.trusted === undefined ? {} : { trusted: flags.trusted }),
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...oidcCommonFlags(),
      realmId: oidcRealmIdFlag(),
      clientId: oidcIdFlag("Client UUID"),
      name: { ...oidcTextFlag("Client display name"), optional: true as const },
      redirectUris: { ...oidcTextFlag("Comma-separated exact redirect URIs"), optional: true as const },
      postLogoutRedirectUris: { ...oidcTextFlag("Comma-separated post-logout redirect URIs"), optional: true as const },
      allowedScopes: { ...oidcTextFlag("Comma-separated allowed scopes"), optional: true as const },
      accessTokenRoleAssertion: {
        brief: "Include project roles in access tokens",
        kind: "boolean" as const,
        optional: true as const,
      },
      additionalOrigins: { ...oidcTextFlag("Comma-separated additional browser origins"), optional: true as const },
      idTokenUserinfoAssertion: {
        brief: "Include scoped claims from UserInfo in ID tokens",
        kind: "boolean" as const,
        optional: true as const,
      },
      trusted: { brief: "Skip consent for this client", kind: "boolean" as const, optional: true as const },
      requireConsent: { brief: "Require consent", kind: "boolean" as const, optional: true as const },
    },
  },
  docs: { brief: "Update an OIDC client" },
})

const oidcCodelineClientEnsureCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcCodelineClientEnsureFlags) {
    const { envFile: _codelineEnvFile, ...connectionFlags } = flags
    const connection = await oidcCliConnectionResolve(this, connectionFlags)
    if (!connection.success) {
      oidcCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    const envFile = flags.envFile ?? this.process.env?.CODELINE_ENV_FILE
    if (realmId === undefined || envFile === undefined || envFile.length === 0) {
      if (envFile === undefined || envFile.length === 0) {
        this.process.stderr.write("Expected input for --env-file or CODELINE_ENV_FILE\n")
        this.process.exitCode = 1
      }
      return
    }
    oidcCliResultWrite(
      this,
      await oidcCodelineClientEnsure({
        api: oidcCliClientCreate(connection.data),
        clientId: flags.clientId,
        envFilePath: envFile,
        name: flags.name ?? "Codeline preview",
        realmId,
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...oidcCommonFlags(),
      realmId: oidcRealmIdFlag(),
      clientId: { ...oidcIdFlag("Existing Codeline client UUID"), optional: true as const },
      envFile: { ...oidcTextFlag("Existing ignored Codeline environment file"), optional: true as const },
      name: { ...oidcTextFlag("Codeline client display name"), optional: true as const },
    },
  },
  docs: { brief: "Ensure the confidential Codeline OIDC client without exposing its secret" },
})

const oidcCodelineProductionClientEnsureCommand = buildCommand({
  async func(this: ApplicationContext) {
    const result = await oidcCodelineProductionClientEnsure({
      credentialEnvelopeWrite: (envelope) => this.process.stdout.write(`${envelope}\n`),
      homeDirectory: "/home/authworks",
    })
    if (result.success) return
    this.process.stderr.write(`${result.errorMessage ?? "The production Codeline client ensure failed."}\n`)
    this.process.exitCode = 1
  },
  parameters: { flags: {} },
  docs: { brief: "Ensure the fixed production Codeline client with a one-time machine credential handoff" },
})

const oidcCodelineProductionSecretRotateCommand = buildCommand({
  async func(this: ApplicationContext) {
    try {
      const result = await oidcCodelineProductionSecretRotate({
        credentialEnvelopeWrite: (envelope) => this.process.stdout.write(`${envelope}\n`),
        homeDirectory: "/home/authworks",
      })
      if (result.success) return
      this.process.stderr.write(oidcCodelineSecretRotateFailureOutputCreate(result))
      this.process.exitCode = oidcCodelineSecretRotateExitCodeGet(result)
    } catch (_error) {
      const code = "oidc.codeline-secret-rotate.internal-failed"
      this.process.stderr.write(oidcCodelineSecretRotateFailureOutputCreate(code))
      this.process.exitCode = oidcCodelineSecretRotateExitCodeGet(code)
    }
  },
  parameters: { flags: {} },
  docs: { brief: "Rotate only the exact fixed production Codeline client secret for machine handoff" },
})

const oidcMultichatProductionClientEnsureCommand = buildCommand({
  async func(this: ApplicationContext) {
    try {
      const result = await oidcMultichatProductionClientEnsure({
        credentialEnvelopeWrite: (envelope) => this.process.stdout.write(`${envelope}\n`),
        homeDirectory: "/home/authworks",
      })
      if (result.success) return
      this.process.stderr.write(result.errorMessage ?? "The production Multichat client ensure failed.")
      this.process.exitCode = 1
    } catch (_error) {
      this.process.stderr.write("The production Multichat client ensure failed.")
      this.process.exitCode = 1
    }
  },
  parameters: { flags: {} },
  docs: { brief: "Ensure the fixed production Multichat client with a one-time machine credential handoff" },
})

const oidcMultichatDevelopmentClientEnsureCommand = buildCommand({
  async func(this: ApplicationContext) {
    try {
      const result = await oidcMultichatDevelopmentClientEnsure({
        credentialEnvelopeWrite: (envelope) => this.process.stdout.write(`${envelope}\n`),
        homeDirectory: "/home/authworks",
      })
      if (result.success) return
      this.process.stderr.write(result.errorMessage ?? "The development Multichat client ensure failed.")
      this.process.exitCode = 1
    } catch (_error) {
      this.process.stderr.write("The development Multichat client ensure failed.")
      this.process.exitCode = 1
    }
  },
  parameters: { flags: {} },
  docs: { brief: "Ensure the fixed development Multichat client with a one-time machine credential handoff" },
})

const oidcMultichatProductionSecretRotateCommand = buildCommand({
  async func(this: ApplicationContext) {
    try {
      const result = await oidcMultichatProductionSecretRotate({
        credentialEnvelopeWrite: (envelope) => this.process.stdout.write(`${envelope}\n`),
        homeDirectory: "/home/authworks",
      })
      if (result.success) return
      this.process.stderr.write(result.errorMessage ?? "The production Multichat secret rotation failed.")
      this.process.exitCode = 1
    } catch (_error) {
      this.process.stderr.write("The production Multichat secret rotation failed.")
      this.process.exitCode = 1
    }
  },
  parameters: { flags: {} },
  docs: { brief: "Rotate only the exact fixed production Multichat client secret for machine handoff" },
})

const oidcMultichatDevelopmentSecretRotateCommand = buildCommand({
  async func(this: ApplicationContext) {
    try {
      const result = await oidcMultichatDevelopmentSecretRotate({
        credentialEnvelopeWrite: (envelope) => this.process.stdout.write(`${envelope}\n`),
        homeDirectory: "/home/authworks",
      })
      if (result.success) return
      this.process.stderr.write(result.errorMessage ?? "The development Multichat secret rotation failed.")
      this.process.exitCode = 1
    } catch (_error) {
      this.process.stderr.write("The development Multichat secret rotation failed.")
      this.process.exitCode = 1
    }
  },
  parameters: { flags: {} },
  docs: { brief: "Rotate only the exact fixed development Multichat client secret for machine handoff" },
})

const oidcCodelineProductionOrganizationIdGetCommand = buildCommand({
  async func(this: ApplicationContext) {
    try {
      const result = await oidcCodelineProductionOrganizationIdGet({ homeDirectory: "/home/authworks" })
      if (result.success) {
        this.process.stdout.write(`${JSON.stringify(result.data)}\n`)
        return
      }
      this.process.stderr.write(oidcCodelineProductionOrganizationIdGetFailureOutputCreate(result))
      this.process.exitCode = oidcCodelineProductionOrganizationIdGetExitCodeGet(result)
    } catch (_error) {
      const code = "oidc.codeline-organization-id-get.internal-failed"
      this.process.stderr.write(oidcCodelineProductionOrganizationIdGetFailureOutputCreate(code))
      this.process.exitCode = oidcCodelineProductionOrganizationIdGetExitCodeGet(code)
    }
  },
  parameters: { flags: {} },
  docs: { brief: "Read the fixed Contentoren production organization ID for one machine handoff" },
})

const oidcMultichatProductionOrganizationIdGetCommand = buildCommand({
  async func(this: ApplicationContext) {
    try {
      const result = await oidcMultichatProductionOrganizationIdGet({ homeDirectory: "/home/authworks" })
      if (result.success) {
        this.process.stdout.write(`${JSON.stringify(result.data)}\n`)
        return
      }
      this.process.stderr.write(result.errorMessage ?? "The production Multichat organization ID read failed.")
      this.process.exitCode = 1
    } catch (_error) {
      this.process.stderr.write("The production Multichat organization ID read failed.")
      this.process.exitCode = 1
    }
  },
  parameters: { flags: {} },
  docs: { brief: "Read the fixed Contentoren organization ID for Multichat without mutation" },
})

const oidcProductionSigningKeyEnsureCommand = buildCommand({
  async func(this: ApplicationContext) {
    try {
      const result = await oidcProductionSigningKeyEnsure({ homeDirectory: "/home/authworks" })
      if (result.success) {
        this.process.stdout.write(`${result.data}\n`)
        return
      }
      this.process.stderr.write(oidcProductionSigningKeyEnsureFailureOutputCreate(result))
      this.process.exitCode = oidcProductionSigningKeyEnsureExitCodeGet(result)
    } catch (_error) {
      const code = "oidc.production-signing-key-ensure.internal-failed"
      this.process.stderr.write(oidcProductionSigningKeyEnsureFailureOutputCreate(code))
      this.process.exitCode = oidcProductionSigningKeyEnsureExitCodeGet(code)
    }
  },
  parameters: { flags: {} },
  docs: { brief: "Ensure one active RS256 signing key for the fixed production realm without rotating" },
})

const oidcClientSecretRotateCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcClientFlags) {
    const connection = await oidcCliConnectionResolve(this, flags)
    if (!connection.success) {
      oidcCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(connection.data).oidcClientSecretRotate(realmId, flags.clientId),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: { ...oidcCommonFlags(), realmId: oidcRealmIdFlag(), clientId: oidcIdFlag("Client UUID") },
  },
  docs: { brief: "Rotate an OIDC client secret" },
})

const oidcSigningKeyCreateCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcRealmFlags) {
    const connection = await oidcCliConnectionResolve(this, flags)
    if (!connection.success) {
      oidcCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    oidcCliResultWrite(this, await oidcCliClientCreate(connection.data).oidcSigningKeyCreate(realmId), [
      connection.data.token,
      connection.data.systemToken,
    ])
  },
  parameters: { flags: { ...oidcCommonFlags(), realmId: oidcRealmIdFlag() } },
  docs: { brief: "Create and activate an OIDC signing key" },
})

const oidcSigningKeyListCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcListRealmFlags) {
    const connection = await oidcCliConnectionResolve(this, flags)
    if (!connection.success) {
      oidcCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(connection.data).oidcSigningKeyList(realmId, oidcListQueryCreate(flags)),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: { flags: { ...oidcCommonFlags(), ...oidcListFlags(), realmId: oidcRealmIdFlag() } },
  docs: { brief: "List OIDC signing keys" },
})

const oidcSigningKeyRetireCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcRealmFlags & { signingKeyId: string }) {
    const connection = await oidcCliConnectionResolve(this, flags)
    if (!connection.success) {
      oidcCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(connection.data).oidcSigningKeyLifecycleSet(realmId, flags.signingKeyId, {
        status: "retired",
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...oidcCommonFlags(),
      realmId: oidcRealmIdFlag(),
      signingKeyId: oidcIdFlag("Signing key UUID"),
    },
  },
  docs: { brief: "Retire an OIDC signing key" },
})

const oidcConsentListCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcConsentListFlags) {
    const connection = await oidcCliConnectionResolve(this, flags)
    if (!connection.success) {
      oidcCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(connection.data).oidcConsentList(realmId, flags.userId, oidcListQueryCreate(flags)),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: { ...oidcCommonFlags(), ...oidcListFlags(), realmId: oidcRealmIdFlag(), userId: oidcIdFlag("User UUID") },
  },
  docs: { brief: "List persisted OIDC consents" },
})

const oidcConsentRevokeCommand = buildCommand({
  async func(this: ApplicationContext, flags: OidcConsentFlags & { clientId: string }) {
    const connection = await oidcCliConnectionResolve(this, flags)
    if (!connection.success) {
      oidcCliResultWrite(this, connection)
      return
    }
    const realmId = scopeIdResolve(this, connection.data.realmId, "realm")
    if (realmId === undefined) return
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(connection.data).oidcConsentRevoke(realmId, flags.userId, {
        client_id: flags.clientId,
      }),
      [connection.data.token, connection.data.systemToken],
    )
  },
  parameters: {
    flags: {
      ...oidcCommonFlags(),
      realmId: oidcRealmIdFlag(),
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
    const connection = await oidcCliConnectionResolve(this, flags)
    if (!connection.success) {
      oidcCliResultWrite(this, connection)
      return
    }
    oidcCliResultWrite(
      this,
      await oidcCliClientCreate(connection.data).oidcLogout({
        ...(flags.clientId === undefined ? {} : { client_id: flags.clientId }),
        ...(flags.idTokenHint === undefined ? {} : { id_token_hint: flags.idTokenHint }),
        ...(flags.postLogoutRedirectUri === undefined ? {} : { post_logout_redirect_uri: flags.postLogoutRedirectUri }),
        ...(flags.state === undefined ? {} : { state: flags.state }),
      }),
      [connection.data.token, flags.idTokenHint],
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
    clientEnsure: oidcCodelineClientEnsureCommand,
    codelineProductionEnsure: oidcCodelineProductionClientEnsureCommand,
    codelineProductionOrganizationIdGet: oidcCodelineProductionOrganizationIdGetCommand,
    codelineProductionSecretRotate: oidcCodelineProductionSecretRotateCommand,
    multichatProductionEnsure: oidcMultichatProductionClientEnsureCommand,
    multichatDevelopmentEnsure: oidcMultichatDevelopmentClientEnsureCommand,
    multichatProductionSecretRotate: oidcMultichatProductionSecretRotateCommand,
    multichatDevelopmentSecretRotate: oidcMultichatDevelopmentSecretRotateCommand,
    multichatProductionOrganizationIdGet: oidcMultichatProductionOrganizationIdGetCommand,
    clientGet: oidcClientGetCommand,
    clientList: oidcClientListCommand,
    clientUpdate: oidcClientUpdateCommand,
    clientSecretRotate: oidcClientSecretRotateCommand,
    keyCreate: oidcSigningKeyCreateCommand,
    keyList: oidcSigningKeyListCommand,
    keyRetire: oidcSigningKeyRetireCommand,
    productionSigningKeyEnsure: oidcProductionSigningKeyEnsureCommand,
    consentList: oidcConsentListCommand,
    consentRevoke: oidcConsentRevokeCommand,
    logout: oidcLogoutCommand,
  },
  docs: { brief: "OIDC client and signing-key administration" },
})

async function oidcCliConnectionResolve(context: ApplicationContext, flags: OidcCliFlags) {
  const connection = await connectionProfileCliConnectionResolve(flags, { environment: context.process.env })
  if (!connection.success) return connection
  return {
    data: {
      ...connection.data,
      systemToken: connectionProfileCliSystemTokenResolve(flags.systemToken ?? flags.token, context.process.env),
    },
    success: true as const,
  }
}

function oidcCliClientCreate(flags: OidcCliFlags) {
  return oidcApiClientCreate({
    baseUrl: flags.server ?? "http://127.0.0.1:3000",
    systemToken: flags.systemToken,
    token: flags.token,
  })
}

function oidcCliResultWrite(
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

function oidcCommonFlags() {
  return {
    ...connectionProfileCliCentralFlags(),
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

function oidcListFlags() {
  return {
    pageSize: { ...oidcTextFlag("Maximum items per page"), optional: true as const },
    pageToken: { ...oidcTextFlag("Opaque page token"), optional: true as const },
    sortBy: { ...oidcTextFlag("Sort field"), optional: true as const },
    sortDirection: {
      ...oidcTextFlag("Sort direction"),
      optional: true as const,
      parse: (value: string) => value as "asc" | "desc",
    },
  }
}

function oidcListQueryCreate(flags: OidcListCliFlags): ListQuery | undefined {
  if (
    flags.pageSize === undefined &&
    flags.pageToken === undefined &&
    flags.sortBy === undefined &&
    flags.sortDirection === undefined
  )
    return undefined
  return {
    ...(flags.pageSize === undefined ? {} : { pageSize: Number(flags.pageSize) }),
    ...(flags.pageToken === undefined ? {} : { pageToken: flags.pageToken }),
    ...(flags.sortBy === undefined ? {} : { sortBy: flags.sortBy }),
    ...(flags.sortDirection === undefined ? {} : { sortDirection: flags.sortDirection }),
  }
}

function oidcIdFlag(brief: string) {
  return { brief, kind: "parsed" as const, parse: (value: string) => value, placeholder: "UUID" }
}

function oidcRealmIdFlag() {
  return { ...oidcIdFlag("Realm UUID"), optional: true as const }
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

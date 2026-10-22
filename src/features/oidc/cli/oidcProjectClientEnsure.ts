import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import type { OidcClient } from "../public/oidcClientSchema.js"
import type { OidcProjectBoundaryConfig, OidcProjectBoundaryEnvironment } from "./oidcProjectBoundaryRegistry.js"

const oidcProjectAllowedScopes = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "urn:zitadel:iam:user:resourceowner",
] as const

type OidcProjectClientEnsureApi = {
  readonly oidcClientCreate: ReturnType<typeof oidcApiClientCreate>["oidcClientCreate"]
  readonly oidcClientGet: ReturnType<typeof oidcApiClientCreate>["oidcClientGet"]
  readonly oidcClientList: ReturnType<typeof oidcApiClientCreate>["oidcClientList"]
  readonly oidcClientLifecycleSet: ReturnType<typeof oidcApiClientCreate>["oidcClientLifecycleSet"]
  readonly oidcClientUpdate: ReturnType<typeof oidcApiClientCreate>["oidcClientUpdate"]
}

type OidcProjectClientConfiguration = {
  readonly name: string
  readonly redirectUris: readonly string[]
}

function oidcProjectClientConfigurationGet(
  project: OidcProjectBoundaryConfig,
  environment: OidcProjectBoundaryEnvironment,
): OidcProjectClientConfiguration {
  return environment === "production"
    ? { name: project.productionName, redirectUris: project.productionRedirectUris }
    : { name: project.developmentName, redirectUris: project.developmentRedirectUris }
}

export async function oidcProjectClientEnsure(options: {
  readonly api: OidcProjectClientEnsureApi
  readonly credentialHandoff: (credentials: {
    readonly clientId: string
    readonly clientSecret: string
  }) => Promise<Result<unknown>>
  readonly environment: OidcProjectBoundaryEnvironment
  readonly project: OidcProjectBoundaryConfig
  readonly realmId: string
}): Promise<
  Result<{
    readonly action: "created" | "updated" | "unchanged"
    readonly client: OidcClient
    readonly credentials: "handed-off" | "preserved"
    readonly environment: OidcProjectBoundaryEnvironment
    readonly pkce: "S256"
  }>
> {
  const op = "oidcProjectClientEnsure"
  const configuration = oidcProjectClientConfigurationGet(options.project, options.environment)
  const target = await oidcProjectClientFind({
    api: options.api,
    configuration,
    project: options.project,
    realmId: options.realmId,
  })
  if (!target.success) return target

  if (target.data === undefined) {
    const created = await options.api.oidcClientCreate(options.realmId, {
      allowedScopes: [...oidcProjectAllowedScopes],
      clientType: "confidential",
      name: configuration.name,
      postLogoutRedirectUris: [],
      redirectUris: [...configuration.redirectUris],
      requireConsent: false,
      trusted: true,
    })
    if (!created.success) return created
    if (created.data.clientSecret === undefined)
      return resultErrorCodedCreate(op, "Authworks did not return the new client secret.", "oidc.invalid")
    const handedOff = await options.credentialHandoff({
      clientId: created.data.client.id,
      clientSecret: created.data.clientSecret,
    })
    if (!handedOff.success)
      return resultErrorCodedCreate(
        op,
        `The ${options.project.displayName} client was created, but its credentials could not be handed off.`,
        "platform.internal",
      )
    return resultCreate({
      action: "created",
      client: created.data.client,
      credentials: "handed-off",
      environment: options.environment,
      pkce: "S256",
    })
  }

  if (target.data.clientType !== "confidential")
    return resultErrorCodedCreate(
      op,
      `The existing ${options.project.displayName} ${options.environment} OIDC client is not confidential; no changes were made.`,
      "oidc.conflict",
    )

  let client = target.data
  let changed = false
  const update = oidcProjectClientUpdateCreate(client, configuration)
  if (Object.keys(update).length > 0) {
    const updated = await options.api.oidcClientUpdate(options.realmId, client.id, update)
    if (!updated.success) return updated
    client = updated.data.client
    changed = true
  }
  if (client.status !== "active") {
    const activated = await options.api.oidcClientLifecycleSet(options.realmId, client.id, { status: "active" })
    if (!activated.success) return activated
    client = activated.data.client
    changed = true
  }
  return resultCreate({
    action: changed ? "updated" : "unchanged",
    client,
    credentials: "preserved",
    environment: options.environment,
    pkce: "S256",
  })
}

async function oidcProjectClientFind(options: {
  readonly api: OidcProjectClientEnsureApi
  readonly configuration: OidcProjectClientConfiguration
  readonly project: OidcProjectBoundaryConfig
  readonly realmId: string
}): Promise<Result<OidcClient | undefined>> {
  const matches: OidcClient[] = []
  let pageToken: string | undefined
  do {
    const listed = await options.api.oidcClientList(options.realmId, {
      pageSize: 100,
      ...(pageToken === undefined ? {} : { pageToken }),
    })
    if (!listed.success) return listed
    matches.push(
      ...listed.data.items.filter(
        (client) =>
          client.name === options.configuration.name ||
          options.configuration.redirectUris.some((redirectUri) => client.redirectUris.includes(redirectUri)),
      ),
    )
    pageToken = listed.data.nextPageToken
  } while (pageToken !== undefined)

  if (matches.length > 1)
    return resultErrorCodedCreate(
      "oidcProjectClientFind",
      `More than one OIDC client matches the fixed ${options.project.displayName} name or redirect URI; no changes were made.`,
      "oidc.conflict",
    )
  const client = matches[0]
  if (client !== undefined && client.name !== options.configuration.name)
    return resultErrorCodedCreate(
      "oidcProjectClientFind",
      `A fixed ${options.project.displayName} redirect URI belongs to a differently named OIDC client; no changes were made.`,
      "oidc.conflict",
    )
  return resultCreate(client)
}

function oidcProjectClientUpdateCreate(client: OidcClient, configuration: OidcProjectClientConfiguration) {
  return {
    ...(client.name === configuration.name ? {} : { name: configuration.name }),
    ...(oidcProjectClientArraysEqual(client.redirectUris, configuration.redirectUris)
      ? {}
      : { redirectUris: [...configuration.redirectUris] }),
    ...(oidcProjectClientArraysEqual(client.postLogoutRedirectUris, []) ? {} : { postLogoutRedirectUris: [] }),
    ...(oidcProjectClientArraysEqual(client.allowedScopes, oidcProjectAllowedScopes)
      ? {}
      : { allowedScopes: [...oidcProjectAllowedScopes] }),
    ...(client.requireConsent === false ? {} : { requireConsent: false }),
    ...(client.trusted === true ? {} : { trusted: true }),
  }
}

function oidcProjectClientArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

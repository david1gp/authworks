import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import type { OidcClient } from "../public/oidcClientSchema.js"
import type { OidcProjectBoundaryConfig, OidcProjectBoundaryEnvironment } from "./oidcProjectBoundaryRegistry.js"

type OidcProjectClientSecretRotateApi = {
  readonly oidcClientList: ReturnType<typeof oidcApiClientCreate>["oidcClientList"]
  readonly oidcClientSecretRotate: ReturnType<typeof oidcApiClientCreate>["oidcClientSecretRotate"]
}

type OidcProjectClientSecretRotateConfiguration = {
  readonly name: string
  readonly redirectUris: readonly string[]
}

function oidcProjectClientSecretRotateConfigurationGet(
  project: OidcProjectBoundaryConfig,
  environment: OidcProjectBoundaryEnvironment,
): OidcProjectClientSecretRotateConfiguration {
  return environment === "production"
    ? { name: project.productionName, redirectUris: project.productionRedirectUris }
    : { name: project.developmentName, redirectUris: project.developmentRedirectUris }
}

export async function oidcProjectClientSecretRotate(options: {
  readonly api: OidcProjectClientSecretRotateApi
  readonly credentialHandoff: (credentials: {
    readonly clientId: string
    readonly clientSecret: string
  }) => Promise<Result<unknown>>
  readonly environment: OidcProjectBoundaryEnvironment
  readonly project: OidcProjectBoundaryConfig
  readonly realmId: string
}): Promise<
  Result<{
    readonly clientId: string
    readonly environment: OidcProjectBoundaryEnvironment
    readonly project: string
    readonly realmId: string
  }>
> {
  const op = "oidcProjectClientSecretRotate"
  const configuration = oidcProjectClientSecretRotateConfigurationGet(options.project, options.environment)
  const target = await oidcProjectClientFind({
    api: options.api,
    configuration,
    project: options.project,
    realmId: options.realmId,
  })
  if (!target.success) return target
  if (target.data === undefined)
    return resultErrorCodedCreate(
      op,
      `The fixed ${options.project.displayName} ${options.environment} OIDC client was not found; no changes were made.`,
      "oidc.not-found",
    )

  const rotated = await options.api.oidcClientSecretRotate(options.realmId, target.data.id)
  if (!rotated.success) return rotated
  if (
    rotated.data.client.id !== target.data.id ||
    !oidcProjectClientIsExact(rotated.data.client, configuration, options.realmId) ||
    !/^[A-Za-z0-9_-]{43}$/.test(rotated.data.clientSecret)
  )
    return resultErrorCodedCreate(
      op,
      `Authworks returned an invalid fixed ${options.project.displayName} credential.`,
      "oidc.invalid",
    )

  const handedOff = await options.credentialHandoff({
    clientId: rotated.data.client.id,
    clientSecret: rotated.data.clientSecret,
  })
  if (!handedOff.success)
    return resultErrorCodedCreate(
      op,
      `The rotated ${options.project.displayName} credential could not be handed off.`,
      "platform.internal",
    )
  return resultCreate({
    clientId: rotated.data.client.id,
    environment: options.environment,
    project: options.project.slug,
    realmId: options.realmId,
  })
}

async function oidcProjectClientFind(options: {
  readonly api: OidcProjectClientSecretRotateApi
  readonly configuration: OidcProjectClientSecretRotateConfiguration
  readonly project: OidcProjectBoundaryConfig
  readonly realmId: string
}): Promise<Result<OidcClient | undefined>> {
  const matches: OidcClient[] = []
  let pageToken: string | undefined
  do {
    const listed = await options.api.oidcClientList(options.realmId, {
      pageSize: 100,
      ...(pageToken === undefined ? {} : { pageToken }),
    } satisfies ListQuery)
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
      `More than one OIDC client matches the fixed ${options.project.displayName} identity; no changes were made.`,
      "oidc.conflict",
    )
  const client = matches[0]
  if (client === undefined) return resultCreate(undefined)
  if (!oidcProjectClientIsExact(client, options.configuration, options.realmId))
    return resultErrorCodedCreate(
      "oidcProjectClientFind",
      `The fixed ${options.project.displayName} identity does not match exactly; no changes were made.`,
      "oidc.conflict",
    )
  return resultCreate(client)
}

function oidcProjectClientIsExact(
  client: OidcClient,
  configuration: OidcProjectClientSecretRotateConfiguration,
  realmId: string,
): boolean {
  return (
    client.realmId === realmId &&
    client.name === configuration.name &&
    client.clientType === "confidential" &&
    client.status === "active" &&
    oidcProjectClientArraysEqual(client.redirectUris, configuration.redirectUris)
  )
}

function oidcProjectClientArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

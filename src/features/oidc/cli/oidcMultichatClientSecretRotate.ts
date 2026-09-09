import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import type { OidcClient } from "../public/oidcClientSchema.js"

const oidcMultichatClientSecretRotateConfiguration = {
  development: {
    name: "Multichat development",
    redirectUris: [
      "http://127.0.0.1:3007/login/authworks/callback",
      "https://preview.multichat.leonardomora.de/login/authworks/callback",
    ],
  },
  production: {
    name: "Multichat production",
    redirectUris: ["https://multichat.contentoren.de/login/authworks/callback"],
  },
} as const

type OidcMultichatEnvironment = keyof typeof oidcMultichatClientSecretRotateConfiguration

type OidcMultichatClientSecretRotateApi = {
  readonly oidcClientList: ReturnType<typeof oidcApiClientCreate>["oidcClientList"]
  readonly oidcClientSecretRotate: ReturnType<typeof oidcApiClientCreate>["oidcClientSecretRotate"]
}

export async function oidcMultichatClientSecretRotate(options: {
  readonly api: OidcMultichatClientSecretRotateApi
  readonly credentialHandoff: (credentials: {
    readonly clientId: string
    readonly clientSecret: string
  }) => Promise<Result<unknown>>
  readonly environment: OidcMultichatEnvironment
  readonly realmId: string
}): Promise<
  Result<{ readonly clientId: string; readonly environment: OidcMultichatEnvironment; readonly realmId: string }>
> {
  const op = "oidcMultichatClientSecretRotate"
  const configuration = oidcMultichatClientSecretRotateConfiguration[options.environment]
  const target = await oidcMultichatClientFind({
    api: options.api,
    configuration,
    realmId: options.realmId,
  })
  if (!target.success) return target
  if (target.data === undefined)
    return resultErrorCodedCreate(
      op,
      "The fixed Multichat OIDC client was not found; no changes were made.",
      "oidc.not-found",
    )

  const rotated = await options.api.oidcClientSecretRotate(options.realmId, target.data.id)
  if (!rotated.success) return rotated
  if (
    rotated.data.client.id !== target.data.id ||
    !oidcMultichatClientIsExact(rotated.data.client, configuration, options.realmId) ||
    !/^[A-Za-z0-9_-]{43}$/.test(rotated.data.clientSecret)
  )
    return resultErrorCodedCreate(op, "Authworks returned an invalid fixed Multichat credential.", "oidc.invalid")

  const handedOff = await options.credentialHandoff({
    clientId: rotated.data.client.id,
    clientSecret: rotated.data.clientSecret,
  })
  if (!handedOff.success)
    return resultErrorCodedCreate(op, "The rotated Multichat credential could not be handed off.", "platform.internal")
  return resultCreate({ clientId: rotated.data.client.id, environment: options.environment, realmId: options.realmId })
}

async function oidcMultichatClientFind(options: {
  readonly api: OidcMultichatClientSecretRotateApi
  readonly configuration: (typeof oidcMultichatClientSecretRotateConfiguration)[OidcMultichatEnvironment]
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
      "oidcMultichatClientFind",
      "More than one OIDC client matches the fixed Multichat identity; no changes were made.",
      "oidc.conflict",
    )
  const client = matches[0]
  if (client === undefined) return resultCreate(undefined)
  if (!oidcMultichatClientIsExact(client, options.configuration, options.realmId))
    return resultErrorCodedCreate(
      "oidcMultichatClientFind",
      "The fixed Multichat identity does not match exactly; no changes were made.",
      "oidc.conflict",
    )
  return resultCreate(client)
}

function oidcMultichatClientIsExact(
  client: OidcClient,
  configuration: (typeof oidcMultichatClientSecretRotateConfiguration)[OidcMultichatEnvironment],
  realmId: string,
): boolean {
  return (
    client.realmId === realmId &&
    client.name === configuration.name &&
    client.clientType === "confidential" &&
    client.status === "active" &&
    oidcMultichatClientArraysEqual(client.redirectUris, configuration.redirectUris)
  )
}

function oidcMultichatClientArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

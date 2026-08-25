import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import type { OidcClient } from "../public/oidcClientSchema.js"
import { oidcCodelineProductionRealmResolve } from "./oidcCodelineProductionRealmResolve.js"
import { oidcCodelineProductionSystemSecretGet } from "./oidcCodelineProductionSystemSecretGet.js"

const productionOrigin = "https://authworks.contentoren.de"
const productionClientName = "Codeline preview"
const productionCallback = "https://preview.codeline.work/api/auth/callback"

type ProductionFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type ProductionOidcApi = {
  readonly oidcClientList: (
    realmId: string,
    query?: ListQuery,
  ) => ReturnType<ReturnType<typeof oidcApiClientCreate>["oidcClientList"]>
  readonly oidcClientSecretRotate: ReturnType<typeof oidcApiClientCreate>["oidcClientSecretRotate"]
}

export async function oidcCodelineProductionSecretRotate(options: {
  readonly credentialEnvelopeWrite: (envelope: string) => void
  readonly fetch?: ProductionFetch
  readonly homeDirectory: string
}): Promise<Result<{ readonly clientId: string }>> {
  const op = "oidcCodelineProductionSecretRotate"
  const secret = await oidcCodelineProductionSystemSecretGet(options.homeDirectory)
  if (!secret.success) return secret
  const realm = await oidcCodelineProductionRealmResolve(
    realmApiClientCreate({ baseUrl: productionOrigin, fetch: options.fetch, token: secret.data }),
  )
  if (!realm.success) return realm
  const api = oidcApiClientCreate({ baseUrl: productionOrigin, fetch: options.fetch, token: secret.data })
  const client = await productionClientResolve(api, realm.data.id)
  if (!client.success) return client
  const rotated = await api.oidcClientSecretRotate(realm.data.id, client.data.id)
  if (!rotated.success) return rotated
  if (
    rotated.data.client.id !== client.data.id ||
    !productionClientIsExact(rotated.data.client, realm.data.id) ||
    !/^[A-Za-z0-9_-]{43}$/.test(rotated.data.clientSecret)
  )
    return resultErrorCodedCreate(op, "Authworks returned an invalid rotated credential.", "platform.invalid-response")
  const envelope = JSON.stringify({
    clientId: rotated.data.client.id,
    clientSecret: rotated.data.clientSecret,
    kind: "authworks.codeline-oidc-credential",
    version: 1,
  })
  try {
    options.credentialEnvelopeWrite(envelope)
  } catch (_error) {
    return resultErrorCodedCreate(op, "The rotated credential could not be handed off.", "platform.internal")
  }
  return resultCreate({ clientId: rotated.data.client.id })
}

async function productionClientResolve(api: ProductionOidcApi, realmId: string): Promise<Result<OidcClient>> {
  const op = "oidcCodelineProductionClientResolve"
  const matches: OidcClient[] = []
  let pageToken: string | undefined
  do {
    const listed = await api.oidcClientList(realmId, {
      pageSize: 100,
      ...(pageToken === undefined ? {} : { pageToken }),
    })
    if (!listed.success) return listed
    matches.push(
      ...listed.data.items.filter(
        (client) => client.name === productionClientName || client.redirectUris.includes(productionCallback),
      ),
    )
    pageToken = listed.data.nextPageToken
  } while (pageToken !== undefined)
  if (matches.length !== 1)
    return resultErrorCodedCreate(
      op,
      matches.length === 0
        ? "The production Codeline client was not found; no changes were made."
        : "The production Codeline client is ambiguous; no changes were made.",
      "oidc.conflict",
    )
  const client = matches[0]
  if (client === undefined || !productionClientIsExact(client, realmId))
    return resultErrorCodedCreate(
      op,
      "The production Codeline client does not have the exact required identity; no changes were made.",
      "oidc.conflict",
    )
  return resultCreate(client)
}

function productionClientIsExact(client: OidcClient, realmId: string): boolean {
  return (
    client.realmId === realmId &&
    client.name === productionClientName &&
    client.clientType === "confidential" &&
    client.status === "active" &&
    client.redirectUris.length === 1 &&
    client.redirectUris[0] === productionCallback
  )
}

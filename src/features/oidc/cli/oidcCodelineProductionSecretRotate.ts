import { type Result, type ResultErr } from "#result"
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
const failurePrefix = "oidc.codeline-secret-rotate"

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
  if (!secret.success) return failureCreate(op, "input-invalid")
  const realm = await oidcCodelineProductionRealmResolve(
    realmApiClientCreate({ baseUrl: productionOrigin, fetch: options.fetch, token: secret.data }),
    {
      ambiguous: `${failurePrefix}.realm-ambiguous`,
      inactive: `${failurePrefix}.realm-inactive`,
      missing: `${failurePrefix}.realm-not-found`,
    },
  )
  if (!realm.success) return failureIsClosed(realm) ? realm : apiFailureCreate(op, realm, "api-invalid-response")
  const api = oidcApiClientCreate({ baseUrl: productionOrigin, fetch: options.fetch, token: secret.data })
  const client = await productionClientResolve(api, realm.data.id)
  if (!client.success) return failureIsClosed(client) ? client : apiFailureCreate(op, client, "api-invalid-response")
  const rotated = await api.oidcClientSecretRotate(realm.data.id, client.data.id)
  if (!rotated.success) return apiFailureCreate(op, rotated, "rotation-rejected")
  if (
    rotated.data.client.id !== client.data.id ||
    !productionClientIsExact(rotated.data.client, realm.data.id) ||
    !/^[A-Za-z0-9_-]{43}$/.test(rotated.data.clientSecret)
  )
    return failureCreate(op, "envelope-invalid")
  const envelope = JSON.stringify({
    clientId: rotated.data.client.id,
    clientSecret: rotated.data.clientSecret,
    kind: "authworks.codeline-oidc-credential",
    version: 1,
  })
  try {
    options.credentialEnvelopeWrite(envelope)
  } catch (_error) {
    return failureCreate(op, "internal-failed")
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
  if (matches.length === 0) return failureCreate(op, "client-not-found")
  if (matches.length > 1) return failureCreate(op, "client-ambiguous")
  const client = matches[0]
  if (client === undefined || client.realmId !== realmId) return failureCreate(op, "internal-failed")
  if (client.status !== "active") return failureCreate(op, "client-inactive")
  if (client.clientType !== "confidential") return failureCreate(op, "client-public")
  if (client.name !== productionClientName) return failureCreate(op, "client-name-mismatch")
  if (client.redirectUris.length !== 1) return failureCreate(op, "client-cardinality-mismatch")
  if (client.redirectUris[0] !== productionCallback) return failureCreate(op, "client-callback-mismatch")
  return resultCreate(client)
}

function apiFailureCreate(
  op: string,
  failure: ResultErr,
  fallback: "api-invalid-response" | "rotation-rejected",
): ResultErr {
  if (
    failure.code === "platform.unauthorized" ||
    failure.code === "platform.forbidden" ||
    failure.statusCode === 401 ||
    failure.statusCode === 403
  )
    return failureCreate(op, "api-unauthorized")
  if (
    failure.code === "platform.unreachable" ||
    failure.code === "platform.unavailable" ||
    (failure.statusCode !== undefined && failure.statusCode >= 500)
  )
    return failureCreate(op, "api-unreachable")
  if (failure.code === "platform.invalid-response") return failureCreate(op, "api-invalid-response")
  return failureCreate(op, fallback)
}

function failureCreate(op: string, suffix: string): ResultErr {
  return resultErrorCodedCreate(op, "The fixed Codeline secret rotation was refused.", `${failurePrefix}.${suffix}`)
}

function failureIsClosed(failure: ResultErr): boolean {
  return failure.code?.startsWith(`${failurePrefix}.`) ?? false
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

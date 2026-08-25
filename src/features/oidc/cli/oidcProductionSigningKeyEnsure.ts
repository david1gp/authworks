import { type Result, type ResultErr } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import type { OidcSigningKey } from "../public/oidcSigningKeySchema.js"
import { oidcCodelineProductionRealmResolve } from "./oidcCodelineProductionRealmResolve.js"
import { oidcCodelineProductionSystemSecretGet } from "./oidcCodelineProductionSystemSecretGet.js"

const productionOrigin = "https://authworks.contentoren.de"
const failurePrefix = "oidc.production-signing-key-ensure"

type ProductionFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type ProductionOidcApi = {
  readonly oidcSigningKeyEnsureActive: ReturnType<typeof oidcApiClientCreate>["oidcSigningKeyEnsureActive"]
  readonly oidcSigningKeyList: (
    realmId: string,
    query?: ListQuery,
  ) => ReturnType<ReturnType<typeof oidcApiClientCreate>["oidcSigningKeyList"]>
}

export async function oidcProductionSigningKeyEnsure(options: {
  readonly fetch?: ProductionFetch
  readonly homeDirectory: string
}): Promise<Result<"created" | "reused">> {
  const op = "oidcProductionSigningKeyEnsure"
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
  const before = await activeSigningKeyResolve(api, realm.data.id)
  if (!before.success) return failureIsClosed(before) ? before : apiFailureCreate(op, before, "api-invalid-response")

  let action: "created" | "reused" = "reused"
  let expected = before.data
  if (expected === null) {
    const ensured = await api.oidcSigningKeyEnsureActive(realm.data.id)
    if (!ensured.success) return apiFailureCreate(op, ensured, "ensure-rejected")
    if (!signingKeyIsValid(ensured.data.signingKey, realm.data.id)) return failureCreate(op, "verification-failed")
    action = ensured.data.action
    expected = ensured.data.signingKey
  }

  const verified = await activeSigningKeyResolve(api, realm.data.id)
  if (!verified.success)
    return failureIsClosed(verified) ? verified : apiFailureCreate(op, verified, "api-invalid-response")
  if (expected === null || verified.data === null || !signingKeysMatch(expected, verified.data))
    return failureCreate(op, "verification-failed")
  return resultCreate(action)
}

async function activeSigningKeyResolve(
  api: ProductionOidcApi,
  realmId: string,
): Promise<Result<OidcSigningKey | null>> {
  const op = "oidcProductionActiveSigningKeyResolve"
  const active: OidcSigningKey[] = []
  const pageTokens = new Set<string>()
  let pageToken: string | undefined
  do {
    const listed = await api.oidcSigningKeyList(realmId, {
      pageSize: 100,
      ...(pageToken === undefined ? {} : { pageToken }),
    })
    if (!listed.success) return listed
    for (const key of listed.data.items) {
      if (key.status !== "active") continue
      if (!signingKeyIsValid(key, realmId)) return failureCreate(op, "verification-failed")
      active.push(key)
    }
    pageToken = listed.data.nextPageToken
    if (pageToken !== undefined) {
      if (pageTokens.has(pageToken)) return failureCreate(op, "api-invalid-response")
      pageTokens.add(pageToken)
    }
  } while (pageToken !== undefined)
  if (active.length > 1) return failureCreate(op, "key-ambiguous")
  return resultCreate(active[0] ?? null)
}

function signingKeyIsValid(key: OidcSigningKey, realmId: string): boolean {
  return (
    key.realmId === realmId &&
    key.status === "active" &&
    key.algorithm === "RS256" &&
    key.retiredAt === null &&
    key.id === key.publicJwk.kid &&
    key.publicJwk.alg === "RS256" &&
    key.publicJwk.kty === "RSA" &&
    key.publicJwk.use === "sig" &&
    /^[A-Za-z0-9_-]+$/.test(key.publicJwk.n) &&
    /^[A-Za-z0-9_-]+$/.test(key.publicJwk.e)
  )
}

function signingKeysMatch(expected: OidcSigningKey, actual: OidcSigningKey): boolean {
  return (
    expected.id === actual.id &&
    expected.createdAt === actual.createdAt &&
    expected.publicJwk.alg === actual.publicJwk.alg &&
    expected.publicJwk.e === actual.publicJwk.e &&
    expected.publicJwk.kid === actual.publicJwk.kid &&
    expected.publicJwk.kty === actual.publicJwk.kty &&
    expected.publicJwk.n === actual.publicJwk.n &&
    expected.publicJwk.use === actual.publicJwk.use
  )
}

function apiFailureCreate(
  op: string,
  failure: ResultErr,
  fallback: "api-invalid-response" | "ensure-rejected",
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
  return resultErrorCodedCreate(
    op,
    "The fixed production signing-key ensure was refused.",
    `${failurePrefix}.${suffix}`,
  )
}

function failureIsClosed(failure: ResultErr): boolean {
  return failure.code?.startsWith(`${failurePrefix}.`) ?? false
}

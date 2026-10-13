import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import type { OidcClient } from "../public/oidcClientSchema.js"
import { oidcCodelineProductionRealmResolve } from "./oidcCodelineProductionRealmResolve.js"
import { oidcCodelineProductionSystemSecretGet } from "./oidcCodelineProductionSystemSecretGet.js"

const productionOrigin = "https://authworks.contentoren.de"
const clientName = "Leo Convex apps (migration testing)"
const redirectUris = [
  "https://api.preview.crm.contentoren.de/api/auth/authworks/callback",
  "https://crm.contentoren.de/auth/authworks/callback",
  "https://multichat.contentoren.de/login/authworks/callback",
  "https://multichat-api.leonardomora.de/api/session/callback",
  "https://multichat-api.contentoren.de/api/session/callback",
  "https://eventoren.leonardomora.de/login/zitadel/callback",
  "https://eventoren.de/login/zitadel/callback",
  "https://coachingcompany-api.leonardomora.de/api/auth/contentoren",
  "https://coachingcompany-api.contentoren.de/api/auth/contentoren",
  "https://api.preview.filmschauspielschule-v2.leonardomora.de/api/auth/contentoren",
  "https://filmschauspielschule-api.contentoren.de/api/auth/contentoren",
  "https://semesterkur.leonardomora.de/login/zitadel/callback",
  "https://semesterkur.com/login/zitadel/callback",
  "https://solid-convex-api.leonardomora.de/api/auth/oidc/callback",
  "https://solid-convex-api.contentoren.de/api/auth/oidc/callback",
  "https://archive-api.leonardomora.de/api/auth/oidc/callback",
  "https://archive-api.contentoren.de/api/auth/oidc/callback",
  "https://api.preview.allgroups.chat/api/auth/contentoren",
  "https://api.allgroups.chat/api/auth/contentoren",
] as const
const allowedScopes = ["openid", "profile", "email", "offline_access", "urn:zitadel:iam:user:resourceowner"] as const

type ProductionFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type EnsureApi = {
  readonly oidcClientCreate: ReturnType<typeof oidcApiClientCreate>["oidcClientCreate"]
  readonly oidcClientList: ReturnType<typeof oidcApiClientCreate>["oidcClientList"]
  readonly oidcClientLifecycleSet: ReturnType<typeof oidcApiClientCreate>["oidcClientLifecycleSet"]
  readonly oidcClientUpdate: ReturnType<typeof oidcApiClientCreate>["oidcClientUpdate"]
}

export async function oidcLeoConvexProductionClientEnsure(options: {
  readonly credentialEnvelopeWrite: (envelope: string) => void
  readonly fetch?: ProductionFetch
  readonly homeDirectory: string
}): Promise<Result<{ readonly action: "created" | "updated" | "unchanged"; readonly realmId: string }>> {
  const op = "oidcLeoConvexProductionClientEnsure"
  const secret = await oidcCodelineProductionSystemSecretGet(options.homeDirectory)
  if (!secret.success)
    return resultErrorCodedCreate(
      op,
      "Check the protected production Authworks system-secret file.",
      "platform.internal",
    )

  const apiOptions = { baseUrl: productionOrigin, fetch: options.fetch, token: secret.data }
  const realm = await oidcCodelineProductionRealmResolve(realmApiClientCreate(apiOptions))
  if (!realm.success)
    return resultErrorCodedCreate(
      op,
      "Could not resolve one active realm whose primary domain is authworks.contentoren.de; verify the production realm and system authorization.",
      "realms.conflict",
    )

  const api = oidcApiClientCreate(apiOptions)
  const ensured = await leoConvexClientEnsure({ api, realmId: realm.data.id })
  if (!ensured.success)
    return resultErrorCodedCreate(
      op,
      "The production Leo Convex OIDC client could not be created or reconciled; verify system authorization and client state.",
      "platform.internal",
    )
  if (ensured.data.action === "created" && ensured.data.credentials === undefined)
    return resultErrorCodedCreate(op, "The new credential handoff was not created.", "platform.internal")

  if (ensured.data.credentials !== undefined) {
    try {
      options.credentialEnvelopeWrite(ensured.data.credentials)
    } catch (_error) {
      return resultErrorCodedCreate(op, "The new production credential could not be handed off.", "platform.internal")
    }
  }
  return resultCreate({ action: ensured.data.action, realmId: realm.data.id })
}

async function leoConvexClientEnsure(options: {
  readonly api: EnsureApi
  readonly realmId: string
}): Promise<Result<{ readonly action: "created" | "updated" | "unchanged"; readonly credentials?: string }>> {
  const clients: OidcClient[] = []
  let pageToken: string | undefined
  do {
    const listed = await options.api.oidcClientList(options.realmId, {
      pageSize: 100,
      ...(pageToken === undefined ? {} : { pageToken }),
    })
    if (!listed.success)
      return resultErrorCodedCreate(
        "leoConvexClientEnsure",
        "Could not inspect production OIDC clients.",
        "platform.internal",
      )
    clients.push(...listed.data.items)
    pageToken = listed.data.nextPageToken
  } while (pageToken !== undefined)
  const matches = clients.filter((client) => client.name === clientName)
  if (matches.length > 1)
    return resultErrorCodedCreate(
      "leoConvexClientEnsure",
      "Multiple clients match the fixed Leo Convex identity; no changes were made.",
      "oidc.conflict",
    )
  const existing = matches[0]
  if (existing === undefined) {
    const created = await options.api.oidcClientCreate(options.realmId, {
      accessTokenRoleAssertion: false,
      allowedScopes: [...allowedScopes],
      clientType: "confidential",
      idTokenUserinfoAssertion: true,
      name: clientName,
      postLogoutRedirectUris: [],
      redirectUris: [...redirectUris],
      requireConsent: false,
      trusted: true,
    })
    if (!created.success || created.data.clientSecret === undefined)
      return resultErrorCodedCreate(
        "leoConvexClientEnsure",
        "Authworks did not create a client with a usable secret.",
        "platform.internal",
      )
    return resultCreate({
      action: "created",
      credentials: JSON.stringify({
        clientId: created.data.client.id,
        clientSecret: created.data.clientSecret,
        kind: "authworks.leo-convex-production-oidc-credential",
        version: 1,
      }),
    })
  }

  if (existing.clientType !== "confidential")
    return resultErrorCodedCreate(
      "leoConvexClientEnsure",
      "The existing Leo Convex OIDC client is not confidential; no changes were made.",
      "oidc.conflict",
    )
  const update = leoConvexClientUpdateCreate(existing)
  let changed = false
  if (Object.keys(update).length > 0) {
    const updated = await options.api.oidcClientUpdate(options.realmId, existing.id, update)
    if (!updated.success)
      return resultErrorCodedCreate(
        "leoConvexClientEnsure",
        "Could not reconcile the production client policy.",
        "platform.internal",
      )
    changed = true
  }
  if (existing.status !== "active") {
    const activated = await options.api.oidcClientLifecycleSet(options.realmId, existing.id, { status: "active" })
    if (!activated.success)
      return resultErrorCodedCreate(
        "leoConvexClientEnsure",
        "Could not activate the production client.",
        "platform.internal",
      )
    changed = true
  }
  return resultCreate({ action: changed ? "updated" : "unchanged" })
}

function leoConvexClientUpdateCreate(client: OidcClient) {
  return {
    ...(client.name === clientName ? {} : { name: clientName }),
    ...(sameValues(client.redirectUris, redirectUris) ? {} : { redirectUris: [...redirectUris] }),
    ...(sameValues(client.postLogoutRedirectUris, []) ? {} : { postLogoutRedirectUris: [] }),
    ...(sameValues(client.allowedScopes, allowedScopes) ? {} : { allowedScopes: [...allowedScopes] }),
    ...(client.accessTokenRoleAssertion === false ? {} : { accessTokenRoleAssertion: false }),
    ...(client.idTokenUserinfoAssertion === true ? {} : { idTokenUserinfoAssertion: true }),
    ...(client.requireConsent === false ? {} : { requireConsent: false }),
    ...(client.trusted === true ? {} : { trusted: true }),
  }
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

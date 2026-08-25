import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import type { OidcClient } from "../public/oidcClientSchema.js"
import { oidcCodelineCredentialsEnvFileClientIdGet } from "./oidcCodelineCredentialsEnvFileClientIdGet.js"
import { oidcCodelineCredentialsEnvFileUpdate } from "./oidcCodelineCredentialsEnvFileUpdate.js"

const oidcCodelineRedirectUri = "https://preview.codeline.work/api/auth/callback"
const oidcCodelineAllowedScopes = ["openid", "profile", "email", "urn:zitadel:iam:user:resourceowner"] as const
const oidcCodelineCredentialAliases = [
  "OIDC_CLIENT_ID",
  "OIDC_CLIENT_SECRET",
  "ZITADEL_CLIENT_ID",
  "ZITADEL_CLIENT_SECRET",
] as const

type OidcCodelineClientEnsureApi = {
  readonly oidcClientCreate: ReturnType<typeof oidcApiClientCreate>["oidcClientCreate"]
  readonly oidcClientGet: ReturnType<typeof oidcApiClientCreate>["oidcClientGet"]
  readonly oidcClientList: ReturnType<typeof oidcApiClientCreate>["oidcClientList"]
  readonly oidcClientLifecycleSet: ReturnType<typeof oidcApiClientCreate>["oidcClientLifecycleSet"]
  readonly oidcClientUpdate: ReturnType<typeof oidcApiClientCreate>["oidcClientUpdate"]
}

export async function oidcCodelineClientEnsure(options: {
  readonly api: OidcCodelineClientEnsureApi
  readonly clientId?: string
  readonly envFilePath: string
  readonly name: string
  readonly realmId: string
}): Promise<
  Result<{
    readonly action: "created" | "updated" | "unchanged"
    readonly client: OidcClient
    readonly credentials: {
      readonly aliases: readonly string[]
      readonly envFilePath: string
      readonly status: "preserved" | "stored"
    }
    readonly pkce: "S256"
  }>
> {
  const op = "oidcCodelineClientEnsure"
  const envClientId = await oidcCodelineCredentialsEnvFileClientIdGet(options.envFilePath)
  if (!envClientId.success) return envClientId
  const target = await codelineClientFind({
    api: options.api,
    clientId: options.clientId ?? envClientId.data.clientId,
    clientIdExplicit: options.clientId !== undefined,
    name: options.name,
    realmId: options.realmId,
  })
  if (!target.success) return target

  if (target.data === undefined) {
    const created = await options.api.oidcClientCreate(options.realmId, {
      allowedScopes: [...oidcCodelineAllowedScopes],
      clientType: "confidential",
      name: options.name,
      postLogoutRedirectUris: [],
      redirectUris: [oidcCodelineRedirectUri],
      requireConsent: false,
      trusted: true,
    })
    if (!created.success) return created
    if (created.data.clientSecret === undefined)
      return resultErrorCodedCreate(op, "Authworks did not return the new client secret.", "oidc.invalid")
    const stored = await oidcCodelineCredentialsEnvFileUpdate({
      clientId: created.data.client.id,
      clientSecret: created.data.clientSecret,
      path: options.envFilePath,
    })
    if (!stored.success)
      return resultErrorCodedCreate(
        op,
        "The Codeline client was created, but its credentials could not be stored.",
        "platform.internal",
      )
    return resultCreate({
      action: "created",
      client: created.data.client,
      credentials: { aliases: oidcCodelineCredentialAliases, envFilePath: options.envFilePath, status: "stored" },
      pkce: "S256",
    })
  }

  if (target.data.clientType !== "confidential")
    return resultErrorCodedCreate(
      op,
      "The existing Codeline OIDC client is not confidential; no changes were made.",
      "oidc.conflict",
    )
  let client = target.data
  let changed = false
  const update = oidcCodelineClientUpdateCreate(client, options.name)
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
    credentials: { aliases: oidcCodelineCredentialAliases, envFilePath: options.envFilePath, status: "preserved" },
    pkce: "S256",
  })
}

async function codelineClientFind(options: {
  readonly api: OidcCodelineClientEnsureApi
  readonly clientId?: string
  readonly clientIdExplicit: boolean
  readonly name: string
  readonly realmId: string
}): Promise<Result<OidcClient | undefined>> {
  if (options.clientId !== undefined) {
    const byId = await options.api.oidcClientGet(options.realmId, options.clientId)
    if (byId.success && byId.status === "current") {
      if (options.clientIdExplicit || oidcCodelineClientIdentityMatches(byId.data.client, options.name))
        return resultCreate(byId.data.client)
    } else if (byId.success)
      return resultErrorCodedCreate(
        "oidcCodelineClientFind",
        "Authworks returned an incomplete OIDC client response.",
        "platform.invalid-response",
      )
    else if (!oidcClientNotFound(byId)) return byId
  }

  const matches: OidcClient[] = []
  let pageToken: string | undefined
  do {
    const listed = await options.api.oidcClientList(options.realmId, {
      pageSize: 100,
      ...(pageToken === undefined ? {} : { pageToken }),
    })
    if (!listed.success) return listed
    matches.push(...listed.data.items.filter((client) => client.name === options.name))
    pageToken = listed.data.nextPageToken
  } while (pageToken !== undefined)

  if (matches.length > 1)
    return resultErrorCodedCreate(
      "oidcCodelineClientFind",
      "More than one OIDC client has the Codeline client name; no changes were made.",
      "oidc.conflict",
    )
  return resultCreate(matches[0])
}

function oidcClientNotFound(result: { readonly code?: string; readonly statusCode?: number }): boolean {
  return result.code === "oidc.not-found" || result.statusCode === 404
}

function oidcCodelineClientIdentityMatches(client: OidcClient, name: string): boolean {
  return client.name === name || client.redirectUris.includes(oidcCodelineRedirectUri)
}

function oidcCodelineClientUpdateCreate(client: OidcClient, name: string) {
  return {
    ...(client.name === name ? {} : { name }),
    ...(oidcCodelineClientArraysEqual(client.redirectUris, [oidcCodelineRedirectUri])
      ? {}
      : { redirectUris: [oidcCodelineRedirectUri] }),
    ...(oidcCodelineClientArraysEqual(client.postLogoutRedirectUris, []) ? {} : { postLogoutRedirectUris: [] }),
    ...(oidcCodelineClientArraysEqual(client.allowedScopes, oidcCodelineAllowedScopes)
      ? {}
      : { allowedScopes: [...oidcCodelineAllowedScopes] }),
    ...(client.requireConsent === false ? {} : { requireConsent: false }),
    ...(client.trusted === true ? {} : { trusted: true }),
  }
}

function oidcCodelineClientArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

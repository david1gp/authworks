import { lstat, readFile, realpath } from "node:fs/promises"
import { join } from "node:path"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import type { Realm } from "../../realms/public/realmSchema.js"
import { oidcApiClientCreate } from "../client/oidcApiClientCreate.js"
import { oidcCodelineClientEnsure } from "./oidcCodelineClientEnsure.js"

const productionOrigin = "https://authworks.contentoren.de"
const productionRealmDomain = "authworks.contentoren.de"
const productionClientName = "Codeline preview"

type ProductionFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export async function oidcCodelineProductionClientEnsure(options: {
  readonly credentialEnvelopeWrite: (envelope: string) => void
  readonly fetch?: ProductionFetch
  readonly homeDirectory: string
}): Promise<Result<{ readonly action: "created" | "updated" | "unchanged"; readonly realmId: string }>> {
  const op = "oidcCodelineProductionClientEnsure"
  const secret = await productionSystemSecretGet(options.homeDirectory)
  if (!secret.success) return secret
  const realmApi = realmApiClientCreate({ baseUrl: productionOrigin, fetch: options.fetch, token: secret.data })
  const realm = await productionRealmResolve(realmApi)
  if (!realm.success) return realm

  let credentialEnvelope: string | undefined
  const ensured = await oidcCodelineClientEnsure({
    api: oidcApiClientCreate({ baseUrl: productionOrigin, fetch: options.fetch, token: secret.data }),
    credentialHandoff: async (credentials) => {
      credentialEnvelope = JSON.stringify({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        kind: "authworks.codeline-oidc-credential",
        version: 1,
      })
      return resultCreate(undefined)
    },
    name: productionClientName,
    realmId: realm.data.id,
  })
  if (!ensured.success) return ensured
  if (ensured.data.action === "created" && credentialEnvelope === undefined)
    return resultErrorCodedCreate(op, "The new credential envelope was not created.", "platform.internal")
  if (ensured.data.action !== "created" && credentialEnvelope !== undefined)
    return resultErrorCodedCreate(op, "An unexpected credential envelope was created.", "platform.internal")
  if (credentialEnvelope !== undefined) {
    try {
      options.credentialEnvelopeWrite(credentialEnvelope)
    } catch (_error) {
      return resultErrorCodedCreate(op, "The new credential envelope could not be handed off.", "platform.internal")
    }
  }
  return resultCreate({ action: ensured.data.action, realmId: realm.data.id })
}

async function productionSystemSecretGet(homeDirectory: string): Promise<Result<Secret>> {
  const op = "productionSystemSecretGet"
  const path = join(homeDirectory, ".config", "authworks", "authworks.env")
  const uid = process.getuid?.()
  if (uid === undefined)
    return resultErrorCodedCreate(
      op,
      "The production Authworks environment owner cannot be verified.",
      "platform.internal",
    )
  try {
    if ((await realpath(path)) !== path)
      return resultErrorCodedCreate(
        op,
        "The production Authworks environment path must not contain symbolic links.",
        "platform.internal",
      )
    const file = await lstat(path)
    if (!file.isFile() || file.isSymbolicLink() || file.uid !== uid || (file.mode & 0o077) !== 0)
      return resultErrorCodedCreate(
        op,
        "The production Authworks environment file is not owner-only.",
        "platform.internal",
      )
    const content = await readFile(path, "utf8")
    const values = content
      .split(/\r?\n/)
      .map((line) => /^AUTHWORKS_SYSTEM_SECRET=(.*)$/.exec(line)?.[1])
      .filter((value): value is string => value !== undefined)
    if (values.length !== 1 || !/^[A-Za-z0-9_-]{32,512}$/.test(values[0] ?? ""))
      return resultErrorCodedCreate(
        op,
        "The production Authworks environment must contain one unambiguous system secret.",
        "platform.internal",
      )
    return resultCreate(new Secret(values[0] ?? ""))
  } catch (_error) {
    return resultErrorCodedCreate(op, "The production Authworks environment could not be read.", "platform.internal")
  }
}

async function productionRealmResolve(api: {
  readonly realmList: (query?: ListQuery) => ReturnType<ReturnType<typeof realmApiClientCreate>["realmList"]>
}): Promise<Result<Realm>> {
  const matches: Realm[] = []
  let pageToken: string | undefined
  do {
    const listed = await api.realmList({ pageSize: 100, ...(pageToken === undefined ? {} : { pageToken }) })
    if (!listed.success) return listed
    matches.push(...listed.data.items.filter((realm) => realm.domains.includes(productionRealmDomain)))
    pageToken = listed.data.nextPageToken
  } while (pageToken !== undefined)
  if (matches.length !== 1)
    return resultErrorCodedCreate(
      "productionRealmResolve",
      matches.length === 0
        ? "No realm owns the production Authworks domain; no changes were made."
        : "More than one realm owns the production Authworks domain; no changes were made.",
      "realms.conflict",
    )
  const realm = matches[0]
  if (realm === undefined || realm.domain !== productionRealmDomain)
    return resultErrorCodedCreate(
      "productionRealmResolve",
      "The production Authworks domain is not the realm's primary domain; no changes were made.",
      "realms.conflict",
    )
  if (realm.status !== "active")
    return resultErrorCodedCreate(
      "productionRealmResolve",
      "The production Authworks realm is not active; no changes were made.",
      "realms.conflict",
    )
  return resultCreate(realm)
}

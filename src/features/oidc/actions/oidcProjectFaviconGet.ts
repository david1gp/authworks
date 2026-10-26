import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcFaviconCacheTtlSelect } from "../domain/oidcFaviconCacheTtlSelect.js"
import { oidcFaviconOriginSelect } from "../domain/oidcFaviconOriginSelect.js"
import type { OidcClientRow } from "../persistence/oidcClientTable.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"

export type OidcProjectFavicon = {
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly contentType: string
  readonly maxAgeSeconds: number
  readonly origin: string
}

type OidcProjectFaviconCacheEntry = {
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly contentType: string
  readonly expiresAt: number
  readonly maxAgeSeconds: number
  readonly origin: string
}

type OidcProjectFaviconGetOptions = {
  readonly cache?: Map<string, OidcProjectFaviconCacheEntry>
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly fetch?: (input: string, init?: RequestInit) => Promise<Response>
  readonly now?: () => number
  readonly projectId: string
  readonly realmId: string
}

const oidcProjectFaviconCache = new Map<string, OidcProjectFaviconCacheEntry>()
const oidcProjectFaviconMaxBytes = 256 * 1024

/**
 * Resolves a project's callback origin from its OIDC clients and proxies that
 * origin's favicon. Responses are cached per origin using the upstream cache
 * headers, defaulting to one week when the origin sends none.
 */
export async function oidcProjectFaviconGet(
  options: OidcProjectFaviconGetOptions,
): Promise<Result<OidcProjectFavicon>> {
  const op = "oidcProjectFaviconGet"
  const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
  if (!authorized.success) return authorized
  const now = options.now?.() ?? Date.now()
  const cache = options.cache ?? oidcProjectFaviconCache
  const rows = oidcRepositoryCreate(options.database.db).clientList(options.realmId)
  if (!rows.success) return rows
  const origin = oidcProjectFaviconRowsOriginSelect(rows.data, options.projectId)
  if (origin === undefined)
    return resultErrorCodedCreate(op, "The project has no callback URLs with a usable origin.", "oidc.not-found")
  const cached = cache.get(origin)
  if (cached !== undefined && cached.expiresAt > now)
    return resultCreate({
      bytes: cached.bytes,
      contentType: cached.contentType,
      maxAgeSeconds: cached.maxAgeSeconds,
      origin: cached.origin,
    })
  const fetched = await oidcProjectFaviconFetch(origin, options.fetch)
  if (!fetched.success) return fetched
  const ttlMs = oidcFaviconCacheTtlSelect({
    cacheControl: fetched.data.cacheControl,
    expires: fetched.data.expires,
    now,
  })
  const favicon: OidcProjectFavicon = {
    bytes: fetched.data.bytes,
    contentType: fetched.data.contentType,
    maxAgeSeconds: Math.floor(ttlMs / 1000),
    origin,
  }
  if (ttlMs > 0) cache.set(origin, { ...favicon, expiresAt: now + ttlMs })
  return resultCreate(favicon)
}

function oidcProjectFaviconRowsOriginSelect(rows: readonly OidcClientRow[], projectId: string): string | undefined {
  for (const row of rows) {
    if (row.projectId !== projectId || row.status === "removed") continue
    const origin = oidcFaviconOriginSelect({
      additionalOrigins: oidcFaviconStringListParse(row.additionalOrigins),
      postLogoutRedirectUris: oidcFaviconStringListParse(row.postLogoutRedirectUris),
      redirectUris: oidcFaviconStringListParse(row.redirectUris),
    })
    if (origin !== undefined) return origin
  }
  return undefined
}

function oidcFaviconStringListParse(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed) || !parsed.every((entry): entry is string => typeof entry === "string")) return []
    return parsed
  } catch (_error) {
    return []
  }
}

async function oidcProjectFaviconFetch(
  origin: string,
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<
  Result<{
    readonly bytes: Uint8Array<ArrayBuffer>
    readonly cacheControl: string | null
    readonly contentType: string
    readonly expires: string | null
  }>
> {
  const op = "oidcProjectFaviconGet"
  let response: Response
  try {
    response = await (fetchImpl ?? fetch)(`${origin}/favicon.ico`, {
      headers: { accept: "image/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    })
  } catch (_error) {
    return resultErrorCodedCreate(op, "The favicon could not be fetched.", "oidc.read-failed")
  }
  if (!response.ok) return resultErrorCodedCreate(op, "The favicon could not be found.", "oidc.not-found")
  const rawContentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? ""
  const contentType = rawContentType.length === 0 ? "image/x-icon" : rawContentType
  if (!contentType.startsWith("image/"))
    return resultErrorCodedCreate(op, "The favicon is not an image.", "oidc.not-found")
  let bytes: Uint8Array<ArrayBuffer>
  try {
    bytes = new Uint8Array(await response.arrayBuffer())
  } catch (_error) {
    return resultErrorCodedCreate(op, "The favicon could not be read.", "oidc.read-failed")
  }
  if (bytes.length === 0 || bytes.length > oidcProjectFaviconMaxBytes)
    return resultErrorCodedCreate(op, "The favicon is not usable.", "oidc.not-found")
  return resultCreate({
    bytes,
    cacheControl: response.headers.get("cache-control"),
    contentType,
    expires: response.headers.get("expires"),
  })
}

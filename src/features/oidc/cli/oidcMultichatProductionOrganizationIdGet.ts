import { type Result, type ResultErr } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { organizationApiClientCreate } from "../../organizations/client/organizationApiClientCreate.js"
import type { Organization } from "../../organizations/public/organizationSchema.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import type { Realm } from "../../realms/public/realmSchema.js"
import { oidcMultichatProductionSystemSecretGet } from "./oidcMultichatProductionSystemSecretGet.js"

const oidcMultichatProductionOrigin = "https://authworks.contentoren.de"
const oidcMultichatProductionRealmDomain = "authworks.contentoren.de"
const oidcMultichatOrganizationName = "Contentoren"

type ProductionFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export async function oidcMultichatProductionOrganizationIdGet(options: {
  readonly fetch?: ProductionFetch
  readonly homeDirectory: string
}): Promise<Result<{ readonly organizationId: string }>> {
  const op = "oidcMultichatProductionOrganizationIdGet"
  const secret = await oidcMultichatProductionSystemSecretGet(options.homeDirectory)
  if (!secret.success) return secret
  const clientOptions = { baseUrl: oidcMultichatProductionOrigin, fetch: options.fetch, token: secret.data }
  const realmApi = realmApiClientCreate(clientOptions)
  const realms = await listAll((query) => realmApi.realmList(query))
  if (!realms.success) return oidcMultichatApiFailureCreate(op, realms)
  const realm = oidcMultichatRealmResolve(realms.data)
  if (!realm.success) return realm
  const organizationApi = organizationApiClientCreate(clientOptions)
  const organizations = await listAll((query) => organizationApi.organizationList(realm.data.id, query))
  if (!organizations.success) return oidcMultichatApiFailureCreate(op, organizations)
  const organization = oidcMultichatOrganizationResolve(organizations.data, realm.data.id)
  if (!organization.success) return organization
  return resultCreate({ organizationId: organization.data.id })
}

function oidcMultichatRealmResolve(realms: readonly Realm[]): Result<Realm> {
  const matches = realms.filter((realm) => realm.domain === oidcMultichatProductionRealmDomain)
  const active = matches.filter((realm) => realm.status === "active")
  if (active.length === 0)
    return oidcMultichatFailureCreate(matches.length === 0 ? "realm-not-found" : "realm-inactive")
  if (active.length !== 1) return oidcMultichatFailureCreate("realm-ambiguous")
  const realm = active[0]
  return realm === undefined ? oidcMultichatFailureCreate("realm-not-found") : resultCreate(realm)
}

function oidcMultichatOrganizationResolve(
  organizations: readonly Organization[],
  realmId: string,
): Result<Organization> {
  const matches = organizations.filter((organization) => organization.name === oidcMultichatOrganizationName)
  const active = matches.filter((organization) => organization.status === "active")
  if (active.length === 0)
    return oidcMultichatFailureCreate(matches.length === 0 ? "organization-not-found" : "organization-inactive")
  if (active.length !== 1) return oidcMultichatFailureCreate("organization-ambiguous")
  const organization = active[0]
  if (organization === undefined || organization.realmId !== realmId)
    return oidcMultichatFailureCreate("organization-inactive")
  return resultCreate(organization)
}

async function listAll<T>(
  list: (query: ListQuery) => Promise<Result<{ readonly items: T[]; readonly nextPageToken?: string }>>,
): Promise<Result<T[]>> {
  const items: T[] = []
  const pageTokens = new Set<string>()
  let pageToken: string | undefined
  do {
    const listed = await list({ pageSize: 100, ...(pageToken === undefined ? {} : { pageToken }) })
    if (!listed.success) return listed
    items.push(...listed.data.items)
    pageToken = listed.data.nextPageToken
    if (pageToken !== undefined) {
      if (pageTokens.has(pageToken)) return oidcMultichatFailureCreate("api-invalid-response")
      pageTokens.add(pageToken)
    }
  } while (pageToken !== undefined)
  return resultCreate(items)
}

function oidcMultichatApiFailureCreate(op: string, failure: ResultErr): ResultErr {
  if (
    failure.code === "platform.unauthorized" ||
    failure.code === "platform.forbidden" ||
    failure.statusCode === 401 ||
    failure.statusCode === 403
  )
    return oidcMultichatFailureCreate("api-unauthorized", op)
  if (
    failure.code === "platform.unreachable" ||
    failure.code === "platform.unavailable" ||
    failure.code === "platform.rate-limited" ||
    failure.statusCode === 429 ||
    (failure.statusCode !== undefined && failure.statusCode >= 500)
  )
    return oidcMultichatFailureCreate("api-unreachable", op)
  return oidcMultichatFailureCreate("api-invalid-response", op)
}

function oidcMultichatFailureCreate(suffix: string, op = "oidcMultichatProductionOrganizationIdGet"): ResultErr {
  return resultErrorCodedCreate(
    op,
    "The fixed production Multichat organization ID read was refused.",
    `oidc.multichat-organization-id-get.${suffix}`,
  )
}

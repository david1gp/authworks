import { type Result, type ResultErr } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { machineUserApiClientCreate } from "../../machineUsers/client/machineUserApiClientCreate.js"
import { organizationApiClientCreate } from "../../organizations/client/organizationApiClientCreate.js"
import type { OrganizationMembership } from "../../organizations/public/organizationMembershipSchema.js"
import type { Organization } from "../../organizations/public/organizationSchema.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import type { Realm } from "../../realms/public/realmSchema.js"
import { userApiClientCreate } from "../../users/client/userApiClientCreate.js"
import type { User } from "../../users/public/userSchema.js"
import { oidcCodelineProductionSystemSecretGet } from "./oidcCodelineProductionSystemSecretGet.js"

const productionOrigin = "https://authworks.contentoren.de"
const productionRealmDomain = "authworks.contentoren.de"
const productionOrganizationName = "Contentoren"
const fixtureUserName = "ssotest"
const failurePrefix = "oidc.codeline-organization-id-get"

type ProductionFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export async function oidcCodelineProductionOrganizationIdGet(options: {
  readonly fetch?: ProductionFetch
  readonly homeDirectory: string
}): Promise<Result<{ readonly organizationId: string }>> {
  const op = "oidcCodelineProductionOrganizationIdGet"
  const secret = await oidcCodelineProductionSystemSecretGet(options.homeDirectory)
  if (!secret.success) return failureCreate(op, "input-invalid")
  const clientOptions = { baseUrl: productionOrigin, fetch: options.fetch, token: secret.data }
  const realmApi = realmApiClientCreate(clientOptions)
  const realms = await listAll((query) => realmApi.realmList(query))
  if (!realms.success) return apiFailureCreate(op, realms)
  const realm = realmResolve(realms.data)
  if (!realm.success) return realm

  const organizationApi = organizationApiClientCreate(clientOptions)
  const organizations = await listAll((query) => organizationApi.organizationList(realm.data.id, query))
  if (!organizations.success) return apiFailureCreate(op, organizations)
  const organization = organizationResolve(organizations.data, realm.data.id)
  if (!organization.success) return organization

  const verified = await fixtureSemanticsVerify({
    clientOptions,
    organizationApi,
    organizations: organizations.data,
    productionOrganizationId: organization.data.id,
    productionRealmId: realm.data.id,
    realms: realms.data,
  })
  if (!verified.success) return verified
  return resultCreate({ organizationId: organization.data.id })
}

async function fixtureSemanticsVerify(options: {
  readonly clientOptions: {
    readonly baseUrl: string
    readonly fetch?: ProductionFetch
    readonly token: Parameters<typeof organizationApiClientCreate>[0]["token"]
  }
  readonly organizationApi: ReturnType<typeof organizationApiClientCreate>
  readonly organizations: readonly Organization[]
  readonly productionOrganizationId: string
  readonly productionRealmId: string
  readonly realms: readonly Realm[]
}): Promise<Result<void>> {
  const op = "oidcCodelineProductionFixtureSemanticsVerify"
  const humans: User[] = []
  const userApi = userApiClientCreate(options.clientOptions)
  const machineApi = machineUserApiClientCreate(options.clientOptions)
  for (const realm of options.realms) {
    const users = await listAll((query) => userApi.userList(realm.id, query))
    if (!users.success) return apiFailureCreate(op, users)
    humans.push(...users.data.filter((user) => normalized(user.userName) === fixtureUserName))
    const machines = await listAll((query) => machineApi.machineUserList(realm.id, query))
    if (!machines.success) return apiFailureCreate(op, machines)
    if (machines.data.some((machine) => normalized(machine.userName) === fixtureUserName))
      return failureCreate(op, "machine-conflict")
  }
  if (humans.length === 0) return resultCreate(undefined)
  if (humans.length !== 1) return failureCreate(op, "human-ambiguous")
  const human = humans[0]
  if (human === undefined || human.realmId !== options.productionRealmId) return failureCreate(op, "human-conflict")
  if (human.state === "deleted") return failureCreate(op, "human-deleted")
  if (human.state !== "active") return failureCreate(op, "human-inactive")

  const memberships: OrganizationMembership[] = []
  for (const organization of options.organizations.filter((candidate) => candidate.status === "active")) {
    const listed = await listAll((query) =>
      options.organizationApi.organizationMembershipList(options.productionRealmId, organization.id, query),
    )
    if (!listed.success) return apiFailureCreate(op, listed)
    memberships.push(...listed.data.filter((membership) => membership.userId === human.id))
  }
  if (memberships.some((membership) => membership.roles.includes("owner") || membership.roles.includes("admin")))
    return failureCreate(op, "membership-elevated")
  if (memberships.length === 0) return failureCreate(op, "membership-missing")
  if (memberships.length !== 1 || memberships[0]?.organizationId !== options.productionOrganizationId)
    return failureCreate(op, "membership-ambiguous")
  if (memberships[0]?.roles.length !== 1 || memberships[0]?.roles[0] !== "member")
    return failureCreate(op, "membership-role-invalid")
  return resultCreate(undefined)
}

function organizationResolve(organizations: readonly Organization[], realmId: string): Result<Organization> {
  const op = "oidcCodelineProductionOrganizationResolve"
  const matches = organizations.filter((organization) => organization.name === productionOrganizationName)
  const active = matches.filter((organization) => organization.status === "active")
  if (active.length === 0)
    return failureCreate(op, matches.length === 0 ? "organization-not-found" : "organization-inactive")
  if (active.length !== 1) return failureCreate(op, "organization-ambiguous")
  const organization = active[0]
  if (organization === undefined || organization.realmId !== realmId) return failureCreate(op, "organization-inactive")
  return resultCreate(organization)
}

function realmResolve(realms: readonly Realm[]): Result<Realm> {
  const op = "oidcCodelineProductionRealmResolve"
  const primary = realms.filter((realm) => realm.domain === productionRealmDomain)
  const active = primary.filter((realm) => realm.status === "active")
  if (active.length === 0) return failureCreate(op, primary.length === 0 ? "realm-not-found" : "realm-inactive")
  if (active.length !== 1) return failureCreate(op, "realm-ambiguous")
  const realm = active[0]
  if (realm === undefined) return failureCreate(op, "realm-not-found")
  return resultCreate(realm)
}

async function listAll<T>(
  list: (query: ListQuery) => Promise<Result<{ items: T[]; nextPageToken?: string }>>,
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
      if (pageTokens.has(pageToken)) return failureCreate("oidcCodelineProductionListAll", "api-invalid-response")
      pageTokens.add(pageToken)
    }
  } while (pageToken !== undefined)
  return resultCreate(items)
}

function apiFailureCreate(op: string, failure: ResultErr): ResultErr {
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
    failure.code === "platform.rate-limited" ||
    failure.statusCode === 429 ||
    (failure.statusCode !== undefined && failure.statusCode >= 500)
  )
    return failureCreate(op, "api-unreachable")
  return failureCreate(op, "api-invalid-response")
}

function failureCreate(op: string, suffix: string): ResultErr {
  return resultErrorCodedCreate(
    op,
    "The fixed production organization ID read was refused.",
    `${failurePrefix}.${suffix}`,
  )
}

function normalized(value: string): string {
  return value.trim().toLowerCase()
}

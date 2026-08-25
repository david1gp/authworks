import { type Result, type ResultErr } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { Secret } from "../../../platform/secrets/Secret.js"
import { machineUserApiClientCreate } from "../../machineUsers/client/machineUserApiClientCreate.js"
import { organizationApiClientCreate } from "../../organizations/client/organizationApiClientCreate.js"
import { organizationMembershipListResponseInvalidFieldClassify } from "../../organizations/client/organizationMembershipListResponseInvalidFieldClassify.js"
import type { OrganizationMembership } from "../../organizations/public/organizationMembershipSchema.js"
import type { Organization } from "../../organizations/public/organizationSchema.js"
import { realmApiClientCreate } from "../../realms/client/realmApiClientCreate.js"
import type { Realm } from "../../realms/public/realmSchema.js"
import { userApiClientCreate } from "../../users/client/userApiClientCreate.js"
import type { User } from "../../users/public/userSchema.js"
import { passwordApiClientCreate } from "../client/passwordApiClientCreate.js"
import { passwordPolicyCheck } from "../domain/passwordPolicyCheck.js"

const productionOrigin = "https://authworks.contentoren.de"
const productionRealmDomain = "authworks.contentoren.de"
const productionOrganizationName = "Contentoren"
const fixtureUserName = "ssotest"

type ProductionFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type ProductionStatus = { readonly status: "created" | "updated" | "reused" }
const membershipListInvalidFields = [
  "envelope",
  "items",
  "id",
  "realm-id",
  "organization-id",
  "user-id",
  "created-at",
  "updated-at",
  "roles",
  "next-page-token",
  "unknown",
] as const
const membershipListInvalidFieldDetails = new Map(
  membershipListInvalidFields.map((field) => [JSON.stringify({ field }), field]),
)
const productionApiStages = [
  "realm-list",
  "organization-list",
  "password-policy-get",
  "user-list",
  "machine-user-list",
  "membership-list",
  "user-create",
  "user-email-verification-set",
  "user-lifecycle-set",
  "password-credential-replace",
  "membership-create",
  "membership-update",
] as const
type ProductionApiStage = (typeof productionApiStages)[number]

export async function passwordContentorenSsoTestProductionEnsure(options: {
  readonly email: string
  readonly fetch?: ProductionFetch
  readonly password: string
  readonly token: Secret | string
}): Promise<Result<ProductionStatus>> {
  const op = "passwordContentorenSsoTestProductionEnsure"
  const input = fixtureInputParse(options.email, options.password)
  if (!input.success) return input
  const clientOptions = {
    baseUrl: productionOrigin,
    fetch: options.fetch,
    organizationMembershipListInvalidResponseErrorGet: membershipListInvalidResponseErrorGetCreate,
    token: options.token,
  }
  const realmApi = realmApiClientCreate(clientOptions)
  const realms = await realmListAll(realmApi)
  if (!realms.success) return realms
  const realm = productionRealmResolve(realms.data)
  if (!realm.success) return realm
  const organizationApi = organizationApiClientCreate(clientOptions)
  const organizations = await organizationListAll(organizationApi, realm.data.id)
  if (!organizations.success) return organizations
  const organization = productionOrganizationResolve(organizations.data, realm.data.id)
  if (!organization.success) return organization
  const passwordApi = passwordApiClientCreate(clientOptions)
  const policy = productionApiResultStage(await passwordApi.passwordPolicyGet(realm.data.id), "password-policy-get")
  if (!policy.success) return policy
  const policyChecked = passwordPolicyCheck(input.data.password.valueGet(), policy.data.policy)
  if (!policyChecked.success)
    return resultErrorCodedCreate(
      op,
      "The password does not meet the production password policy; no changes were made.",
      "passwords.contentoren-ssotest-ensure.password-policy-rejected",
    )
  const userApi = userApiClientCreate(clientOptions)
  const users = await fixtureUsersFind(userApi, realms.data, input.data.email)
  if (!users.success) return users
  const machines = await fixtureMachineUsersRefuse(machineUserApiClientCreate(clientOptions), realms.data)
  if (!machines.success) return machines
  const current = fixtureUserResolve(users.data, realm.data.id, input.data.email)
  if (!current.success) return current
  const memberships =
    current.data === null
      ? resultCreate<OrganizationMembership[]>([])
      : await fixtureMembershipsFind(organizationApi, realm.data.id, organizations.data, current.data.id)
  if (!memberships.success) return memberships
  const membership = fixtureMembershipResolve(memberships.data, organization.data.id)
  if (!membership.success) return membership

  let changed = false
  let user = current.data
  if (user === null) {
    const created = productionApiResultStage(
      await userApi.userCreate(realm.data.id, {
        email: input.data.email,
        profile: {},
        userName: fixtureUserName,
      }),
      "user-create",
    )
    if (!created.success) return created
    user = created.data.user
  }
  if (user.realmId !== realm.data.id)
    return resultErrorCodedCreate(
      op,
      "The fixture user belongs to another realm; no changes were made.",
      "passwords.contentoren-ssotest-ensure.human-conflict",
    )
  if (!user.emailVerified || user.registrationVerifiedAt === undefined) {
    const verified = productionApiResultStage(
      await userApi.userEmailVerificationSet(realm.data.id, user.id, { state: "verified" }),
      "user-email-verification-set",
    )
    if (!verified.success) return verified
    user = verified.data.user
    changed = true
  }
  if (user.state !== "active") {
    if (user.state === "deleted")
      return resultErrorCodedCreate(
        op,
        "The fixture user is deleted; no changes were made.",
        "passwords.contentoren-ssotest-ensure.human-deleted",
      )
    const activated = productionApiResultStage(
      await userApi.userLifecycleSet(realm.data.id, user.id, { state: "active" }),
      "user-lifecycle-set",
    )
    if (!activated.success) return activated
    user = activated.data.user
    changed = true
  }
  const replaced = productionApiResultStage(
    await passwordApi.passwordCredentialReplace(realm.data.id, user.id, {
      password: input.data.password.valueGet(),
    }),
    "password-credential-replace",
  )
  if (!replaced.success) return replaced
  changed ||= replaced.data.changed
  if (membership.data === null) {
    const created = productionApiResultStage(
      await organizationApi.organizationMembershipCreate(realm.data.id, organization.data.id, {
        roles: ["member"],
        userId: user.id,
      }),
      "membership-create",
    )
    if (!created.success) return created
    changed = true
  } else if (membership.data.roles.length !== 1 || membership.data.roles[0] !== "member") {
    const updated = productionApiResultStage(
      await organizationApi.organizationMembershipUpdate(realm.data.id, organization.data.id, membership.data.id, {
        roles: ["member"],
      }),
      "membership-update",
    )
    if (!updated.success) return updated
    changed = true
  }
  return resultCreate({ status: current.data === null ? "created" : changed ? "updated" : "reused" })
}

function fixtureInputParse(emailInput: string, passwordInput: string): Result<{ email: string; password: Secret }> {
  const email = emailInput.trim().toLowerCase()
  if (email.length < 3 || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return resultErrorCodedCreate(
      "fixtureInputParse",
      "The private fixture input is malformed; no changes were made.",
      "passwords.contentoren-ssotest-ensure.input-invalid",
    )
  if (passwordInput.length < 1 || passwordInput.length > 1024 || /[\0\r\n]/.test(passwordInput))
    return resultErrorCodedCreate(
      "fixtureInputParse",
      "The private fixture input is malformed; no changes were made.",
      "passwords.contentoren-ssotest-ensure.input-invalid",
    )
  return resultCreate({ email, password: new Secret(passwordInput) })
}

async function realmListAll(api: ReturnType<typeof realmApiClientCreate>): Promise<Result<Realm[]>> {
  const items: Realm[] = []
  let pageToken: string | undefined
  do {
    const listed = productionApiResultStage(await api.realmList(pageQueryCreate(pageToken)), "realm-list")
    if (!listed.success) return listed
    items.push(...listed.data.items)
    pageToken = listed.data.nextPageToken
  } while (pageToken !== undefined)
  return resultCreate(items)
}

function productionRealmResolve(realms: readonly Realm[]): Result<Realm> {
  const matches = realms.filter((realm) => realm.domains.includes(productionRealmDomain))
  if (matches.length !== 1)
    return resultErrorCodedCreate(
      "productionRealmResolve",
      matches.length === 0
        ? "No realm owns the production Authworks domain; no changes were made."
        : "More than one realm owns the production Authworks domain; no changes were made.",
      matches.length === 0
        ? "passwords.contentoren-ssotest-ensure.realm-not-found"
        : "passwords.contentoren-ssotest-ensure.realm-ambiguous",
    )
  const realm = matches[0]
  if (realm === undefined || realm.domain !== productionRealmDomain || realm.status !== "active")
    return resultErrorCodedCreate(
      "productionRealmResolve",
      "The production Authworks realm is not active and primary; no changes were made.",
      "passwords.contentoren-ssotest-ensure.realm-inactive",
    )
  return resultCreate(realm)
}

async function organizationListAll(
  api: ReturnType<typeof organizationApiClientCreate>,
  realmId: string,
): Promise<Result<Organization[]>> {
  const items: Organization[] = []
  let pageToken: string | undefined
  do {
    const listed = productionApiResultStage(
      await api.organizationList(realmId, pageQueryCreate(pageToken)),
      "organization-list",
    )
    if (!listed.success) return listed
    items.push(...listed.data.items)
    pageToken = listed.data.nextPageToken
  } while (pageToken !== undefined)
  return resultCreate(items)
}

function productionOrganizationResolve(organizations: readonly Organization[], realmId: string): Result<Organization> {
  const matches = organizations.filter((organization) => organization.name === productionOrganizationName)
  if (matches.length !== 1)
    return resultErrorCodedCreate(
      "productionOrganizationResolve",
      matches.length === 0
        ? "No Contentoren organization exists in the production realm; no changes were made."
        : "More than one Contentoren organization exists in the production realm; no changes were made.",
      matches.length === 0
        ? "passwords.contentoren-ssotest-ensure.organization-not-found"
        : "passwords.contentoren-ssotest-ensure.organization-ambiguous",
    )
  const organization = matches[0]
  if (organization === undefined || organization.realmId !== realmId || organization.status !== "active")
    return resultErrorCodedCreate(
      "productionOrganizationResolve",
      "The Contentoren organization is not active in the production realm; no changes were made.",
      "passwords.contentoren-ssotest-ensure.organization-inactive",
    )
  return resultCreate(organization)
}

async function fixtureUsersFind(
  api: ReturnType<typeof userApiClientCreate>,
  realms: readonly Realm[],
  email: string,
): Promise<Result<User[]>> {
  const matches: User[] = []
  for (const realm of realms) {
    let pageToken: string | undefined
    do {
      const listed = productionApiResultStage(await api.userList(realm.id, pageQueryCreate(pageToken)), "user-list")
      if (!listed.success) return listed
      matches.push(
        ...listed.data.items.filter(
          (user) => user.userName.trim().toLowerCase() === fixtureUserName || user.email.trim().toLowerCase() === email,
        ),
      )
      pageToken = listed.data.nextPageToken
    } while (pageToken !== undefined)
  }
  return resultCreate(matches)
}

function fixtureUserResolve(users: readonly User[], realmId: string, email: string): Result<User | null> {
  if (users.length === 0) return resultCreate(null)
  if (users.length !== 1)
    return resultErrorCodedCreate(
      "fixtureUserResolve",
      "More than one human matches the fixture identity; no changes were made.",
      "passwords.contentoren-ssotest-ensure.human-ambiguous",
    )
  const user = users[0]
  if (
    user === undefined ||
    user.realmId !== realmId ||
    user.userName.trim().toLowerCase() !== fixtureUserName ||
    user.email.trim().toLowerCase() !== email
  )
    return resultErrorCodedCreate(
      "fixtureUserResolve",
      "The fixture identity conflicts with an existing or cross-realm human; no changes were made.",
      "passwords.contentoren-ssotest-ensure.human-conflict",
    )
  if (user.state === "deleted")
    return resultErrorCodedCreate(
      "fixtureUserResolve",
      "The fixture identity belongs to a deleted human; no changes were made.",
      "passwords.contentoren-ssotest-ensure.human-deleted",
    )
  return resultCreate(user)
}

async function fixtureMachineUsersRefuse(
  api: ReturnType<typeof machineUserApiClientCreate>,
  realms: readonly Realm[],
): Promise<Result<void>> {
  for (const realm of realms) {
    let pageToken: string | undefined
    do {
      const listed = productionApiResultStage(
        await api.machineUserList(realm.id, pageQueryCreate(pageToken)),
        "machine-user-list",
      )
      if (!listed.success) return listed
      if (listed.data.items.some((user) => user.userName.trim().toLowerCase() === fixtureUserName))
        return resultErrorCodedCreate(
          "fixtureMachineUsersRefuse",
          "The fixture identity belongs to a machine user; no changes were made.",
          "passwords.contentoren-ssotest-ensure.machine-conflict",
        )
      pageToken = listed.data.nextPageToken
    } while (pageToken !== undefined)
  }
  return resultCreate(undefined)
}

async function fixtureMembershipsFind(
  api: ReturnType<typeof organizationApiClientCreate>,
  realmId: string,
  organizations: readonly Organization[],
  userId: string,
): Promise<Result<OrganizationMembership[]>> {
  const matches: OrganizationMembership[] = []
  for (const organization of organizations.filter((candidate) => candidate.status === "active")) {
    let pageToken: string | undefined
    do {
      const listed = productionApiResultStage(
        await api.organizationMembershipList(realmId, organization.id, pageQueryCreate(pageToken)),
        "membership-list",
      )
      if (!listed.success) return listed
      matches.push(...listed.data.items.filter((membership) => membership.userId === userId))
      pageToken = listed.data.nextPageToken
    } while (pageToken !== undefined)
  }
  return resultCreate(matches)
}

function fixtureMembershipResolve(
  memberships: readonly OrganizationMembership[],
  organizationId: string,
): Result<OrganizationMembership | null> {
  if (memberships.some((membership) => membership.roles.includes("owner") || membership.roles.includes("admin")))
    return resultErrorCodedCreate(
      "fixtureMembershipResolve",
      "The fixture human has elevated access; no changes were made.",
      "passwords.contentoren-ssotest-ensure.membership-elevated",
    )
  if (memberships.length === 0) return resultCreate(null)
  if (memberships.length !== 1 || memberships[0]?.organizationId !== organizationId)
    return resultErrorCodedCreate(
      "fixtureMembershipResolve",
      "The fixture human has ambiguous organization memberships; no changes were made.",
      "passwords.contentoren-ssotest-ensure.membership-ambiguous",
    )
  return resultCreate(memberships[0] ?? null)
}

function pageQueryCreate(pageToken: string | undefined): ListQuery {
  return { pageSize: 100, ...(pageToken === undefined ? {} : { pageToken }) }
}

function productionApiResultStage<T>(result: Result<T>, stage: ProductionApiStage): Result<T> {
  if (result.success || result.code !== "platform.invalid-response") return result
  if (stage === "membership-list") {
    const field = membershipListInvalidFieldGet(result)
    return resultErrorCodedCreate(
      result.op,
      "The server returned an invalid response.",
      `passwords.contentoren-ssotest-ensure.api-invalid-response.membership-list.${field}`,
    )
  }
  return resultErrorCodedCreate(
    result.op,
    "The server returned an invalid response.",
    `passwords.contentoren-ssotest-ensure.api-invalid-response.${stage}`,
  )
}

function membershipListInvalidResponseErrorGetCreate(body: unknown): ResultErr {
  return resultErrorCodedCreate(
    "organizationApiClientMembershipList",
    "The server returned an invalid response.",
    "platform.invalid-response",
    { field: organizationMembershipListResponseInvalidFieldClassify(body) },
  )
}

function membershipListInvalidFieldGet(result: ResultErr): (typeof membershipListInvalidFields)[number] {
  return membershipListInvalidFieldDetails.get(result.errorData ?? "") ?? "unknown"
}

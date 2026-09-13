import { createHash } from "node:crypto"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { oidcOriginValidate } from "../../oidc/public/oidcOriginValidate.js"
import { zitadelApiClientCreate } from "../client/zitadelApiClientCreate.js"
import type { ZitadelMigrationIssue } from "../public/zitadelMigrationIssue.js"
import { zitadelMigrationResultIssueClassify } from "../public/zitadelMigrationResultIssueClassify.js"
import {
  type ZitadelMigrationSnapshot,
  zitadelMigrationSnapshotSchema,
} from "../public/zitadelMigrationSnapshotSchema.js"

// Values mirror the generated v2 enum contracts; serialized names are handled below.
const OrganizationState = { ACTIVE: 1, INACTIVE: 2, REMOVED: 3 } as const
const ProjectState = { ACTIVE: 1, INACTIVE: 2 } as const
const GrantedProjectState = { ACTIVE: 1, INACTIVE: 2 } as const
const UserState = { ACTIVE: 1, INACTIVE: 2, DELETED: 3, LOCKED: 4, INITIAL: 5, REMOVED: 3 } as const
const ApplicationState = { ACTIVE: 1, INACTIVE: 2, REMOVED: 3 } as const

type ZitadelApiClient = ReturnType<typeof zitadelApiClientCreate>
export type ZitadelMigrationSkippedRecord = {
  readonly entity: string
  readonly reason: string
  readonly sourceId: string
}
export type ZitadelMigrationCount = {
  readonly created: number
  readonly deleted: number
  readonly exported: number
  readonly imported: number
  readonly seen: number
  readonly skipped: number
  readonly unchanged: number
  readonly updated: number
}
export type ZitadelMigrationExportReport = {
  readonly counts: Readonly<Record<string, ZitadelMigrationCount>>
  readonly skipped: readonly ZitadelMigrationSkippedRecord[]
  readonly unsupported: readonly ZitadelMigrationSkippedRecord[]
  readonly issues: readonly ZitadelMigrationIssue[]
}

export type ZitadelMigrationExportOptions = {
  readonly api: ZitadelApiClient
}

const entities = [
  "users",
  "organizations",
  "organizationMemberships",
  "projects",
  "projectRoles",
  "projectGrants",
  "oidcApplications",
  "machineUsers",
  "domains",
  "loginPolicies",
  "identityProviders",
  "externalIdentityLinks",
] as const

const collectionBySkippedEntity: Readonly<Record<string, keyof ZitadelMigrationSnapshot["completeness"]>> = {
  user: "users",
  organization: "organizations",
  organizationMembership: "organizationMemberships",
  project: "projects",
  projectRole: "projectRoles",
  projectGrant: "projectGrants",
  oidcApplication: "oidcApplications",
  machineUser: "machineUsers",
  domain: "domains",
  loginPolicy: "loginPolicies",
  identityProvider: "identityProviders",
  externalIdentityLink: "externalIdentityLinks",
}

export async function zitadelMigrationExport(
  options: ZitadelMigrationExportOptions,
): Promise<Result<{ readonly report: ZitadelMigrationExportReport; readonly snapshot: ZitadelMigrationSnapshot }>> {
  const unsupported: ZitadelMigrationSkippedRecord[] = []
  const skipped: ZitadelMigrationSkippedRecord[] = []
  const issues: ZitadelMigrationIssue[] = []
  const complete: Record<string, boolean> = Object.fromEntries(entities.map((entity) => [entity, true]))

  const organizationsResult = await options.api.organizationsList()
  if (!organizationsResult.success) {
    complete.organizations = false
    issues.push(zitadelMigrationResultIssueClassify("organizations", organizationsResult))
  }
  const organizations: ZitadelMigrationSnapshot["organizations"] = []
  for (const raw of organizationsResult.success ? organizationsResult.data : []) {
    const organization = organizationMap(raw)
    if (organization === undefined) {
      skipped.push({ entity: "organization", reason: "required-fields-missing", sourceId: sourceIdGet(raw) })
      continue
    }
    organizations.push(organization)
  }
  const organizationIds = organizations.map((organization) => organization.id)

  const usersResult = await options.api.usersList(organizationIds)
  if (!usersResult.success) {
    complete.users = false
    issues.push(zitadelMigrationResultIssueClassify("users", usersResult))
  }
  const machineUsersResult = await options.api.machineUsersList(organizationIds)
  const users: ZitadelMigrationSnapshot["users"] = []
  const externalIdentityLinks: ZitadelMigrationSnapshot["externalIdentityLinks"] = []
  const machineUsers: ZitadelMigrationSnapshot["machineUsers"] = []
  const exportedMachineIds = new Set<string>()
  if (machineUsersResult.success) {
    for (const raw of machineUsersResult.data) {
      const machine = machineUserMap(raw)
      if (machine !== undefined) {
        exportedMachineIds.add(machine.sourceId)
        if (!machineUsers.some((item) => item.sourceId === machine.sourceId)) machineUsers.push(machine)
      } else {
        unsupported.push({
          entity: "machineUser",
          reason: missingReason(machineUserMissingFields(raw)),
          sourceId: sourceIdGet(raw),
        })
      }
    }
  }
  for (const raw of usersResult.success ? usersResult.data : []) {
    const id = sourceIdGet(raw)
    const user = userMap(raw)
    if (user === undefined) {
      if (exportedMachineIds.has(id)) continue
      const human = objectGet(raw.human)
      unsupported.push({
        entity: "user",
        reason: human === undefined ? "machine-or-unsupported-user" : missingReason(userMissingFields(raw)),
        sourceId: id,
      })
      continue
    }
    users.push(user)
    const linksResult =
      options.api.userIdentityLinksList === undefined
        ? resultErrorCodedCreate(
            "zitadelMigrationExport",
            "The ZITADEL identity links could not be read.",
            "zitadel-migration.source-request-failed",
          )
        : await options.api.userIdentityLinksList(id)
    if (!linksResult.success) {
      complete.externalIdentityLinks = false
      issues.push(zitadelMigrationResultIssueClassify("externalIdentityLinks", linksResult))
      continue
    }
    for (const link of linksResult.data) {
      const mappedLink = externalIdentityLinkMap(link, id)
      if (mappedLink === undefined)
        skipped.push({ entity: "externalIdentityLink", reason: "required-fields-missing", sourceId: id })
      else externalIdentityLinks.push(mappedLink)
    }
    if (objectHasValue(raw.human, "passwordChanged"))
      unsupported.push({ entity: "userPassword", reason: "password-credentials-not-portable", sourceId: id })
  }

  const organizationMemberships: ZitadelMigrationSnapshot["organizationMemberships"] = []
  for (const organizationId of organizationIds) {
    const membershipsResult = await options.api.organizationMembershipsList(organizationId)
    if (!membershipsResult.success) {
      complete.organizationMemberships = false
      issues.push(zitadelMigrationResultIssueClassify("organizationMemberships", membershipsResult))
      continue
    }
    for (const raw of membershipsResult.data) {
      const membership = organizationMembershipMap(raw, organizationId)
      if (membership === undefined) {
        unsupported.push({
          entity: "organizationMembership",
          reason: missingReason(membershipMissingFields(raw)),
          sourceId: sourceIdGet(raw),
        })
        continue
      }
      organizationMemberships.push(membership)
    }
  }
  const machineUsersComplete = machineUsersResult.success

  const domains: ZitadelMigrationSnapshot["domains"] = []
  const loginPolicies: ZitadelMigrationSnapshot["loginPolicies"] = []
  const identityProviders: ZitadelMigrationSnapshot["identityProviders"] = []
  let domainsComplete = true
  let loginPoliciesComplete = true
  let identityProvidersComplete = true
  const policyProviderRefs: Readonly<Record<string, unknown>>[] = []
  const domainNames = new Set<string>()
  for (const organizationId of organizationIds) {
    let domainsResult: Result<Readonly<Record<string, unknown>>[]> = resultCreate([])
    if (options.api.organizationDomainsList === undefined) {
      domainsComplete = false
      domainsResult = resultCreate([])
    } else domainsResult = await options.api.organizationDomainsList(organizationId)
    if (!domainsResult.success) {
      domainsComplete = false
      issues.push(zitadelMigrationResultIssueClassify("domains", domainsResult))
    } else {
      for (const raw of domainsResult.data) {
        const domain = domainMap(raw, organizationId)
        if (domain === undefined) {
          domainsComplete = false
          skipped.push({ entity: "domain", reason: "required-fields-missing", sourceId: sourceIdGet(raw) })
        } else if (domainNames.has(domain.domain)) {
          domainsComplete = false
          skipped.push({ entity: "domain", reason: "duplicate-normalized-natural-key", sourceId: domain.sourceId })
        } else {
          domainNames.add(domain.domain)
          domains.push(domain)
        }
      }
    }
    let policyResult: Result<Readonly<Record<string, unknown>>> = resultCreate({})
    if (options.api.organizationLoginPolicyGet === undefined) {
      loginPoliciesComplete = false
      policyResult = resultCreate({})
    } else policyResult = await options.api.organizationLoginPolicyGet(organizationId)
    if (!policyResult.success) {
      loginPoliciesComplete = false
      issues.push(zitadelMigrationResultIssueClassify("loginPolicies", policyResult))
    } else {
      if (policyResult.data.isDefault === true && policyResult.data.policy === undefined) continue
      const policy = loginPolicyMap(policyResult.data, organizationId)
      policyProviderRefs.push(...loginPolicyProviderRefsGet(policyResult.data))
      if (policy === undefined) {
        loginPoliciesComplete = false
        skipped.push({ entity: "loginPolicy", reason: "required-fields-missing", sourceId: organizationId })
      } else loginPolicies.push(policy)
    }
  }

  let identityProvidersResult: Result<Readonly<Record<string, unknown>>[]> = resultCreate([])
  const identityProviderListingIds = new Set<string>()
  if (options.api.identityProvidersList === undefined) {
    identityProvidersComplete = false
    identityProvidersResult = resultCreate([])
  } else identityProvidersResult = await options.api.identityProvidersList(organizationIds)
  if (!identityProvidersResult.success) {
    identityProvidersComplete = false
    issues.push(zitadelMigrationResultIssueClassify("identityProviders", identityProvidersResult))
  } else {
    for (const raw of identityProvidersResult.data) {
      const sourceId = sourceIdGet(raw)
      if (sourceId !== "unknown") identityProviderListingIds.add(sourceId)
      const provider = identityProviderMap(raw)
      if (provider === undefined) {
        identityProvidersComplete = false
        skipped.push({
          entity: "identityProvider",
          reason: "unsupported-or-required-fields-missing",
          sourceId: sourceIdGet(raw),
        })
      } else if (provider.authworksType === null || provider.authworksType === undefined) {
        identityProvidersComplete = false
        skipped.push({
          entity: "identityProvider",
          reason: "unsupported-provider-reconfiguration-required",
          sourceId: provider.sourceId,
        })
      } else identityProviders.push(provider)
    }
  }
  const recognizedPolicyProviderRefs = policyProviderRefs.filter((raw) => {
    const sourceId = policyProviderRefIdGet(raw)
    const name = policyProviderRefNameGet(raw)
    const type = stringGet(raw.type)
    return sourceId !== undefined && (providerTypeMap(name) ?? providerTypeMap(type)) !== undefined
  })
  const knownPolicyProviderRefs = new Set<string>()
  for (const raw of policyProviderRefs) {
    const sourceId = policyProviderRefIdGet(raw)
    if (sourceId === undefined || identityProviderListingIds.has(sourceId)) continue
    const name = policyProviderRefNameGet(raw)
    const type = stringGet(raw.type)
    if (providerTypeMap(name) !== undefined || providerTypeMap(type) !== undefined) continue
    if (knownPolicyProviderRefs.has(sourceId)) continue
    knownPolicyProviderRefs.add(sourceId)
    identityProvidersComplete = false
    skipped.push({
      entity: "identityProvider",
      reason: "unsupported-provider-reconfiguration-required",
      sourceId,
    })
  }
  const providerResultWasUnavailable =
    !identityProvidersResult.success || options.api.identityProvidersList === undefined
  const providerResultWasInconsistent = identityProvidersResult.success && identityProvidersResult.data.length === 0
  const missingRecognizedPolicyProvider = recognizedPolicyProviderRefs.some(
    (raw) => !identityProviderListingIds.has(policyProviderRefIdGet(raw) ?? ""),
  )
  if (
    (providerResultWasUnavailable || providerResultWasInconsistent || missingRecognizedPolicyProvider) &&
    recognizedPolicyProviderRefs.length > 0
  ) {
    identityProvidersComplete = false
    issues.push({ collection: "identityProviders", code: "fallback-used", reason: "policy-reference-fallback-used" })
    const known = new Map<string, (typeof identityProviders)[number]>()
    const ambiguous = new Set<string>()
    for (const provider of identityProviders) known.set(provider.sourceId, provider)
    for (const raw of recognizedPolicyProviderRefs) {
      const sourceId = policyProviderRefIdGet(raw)
      const name = policyProviderRefNameGet(raw)
      const type = stringGet(raw.type)
      const authworksType = providerTypeMap(name) ?? providerTypeMap(type)
      const providerName = name ?? type
      if (sourceId === undefined || providerName === undefined || authworksType === undefined) {
        identityProvidersComplete = false
        continue
      }
      const provider = {
        sourceId,
        name: providerName,
        provider: "oidc" as const,
        authworksType,
        // A policy reference is an active source reference even when the
        // provider administration endpoint could not be read.
        enabled: true,
        clientId: undefined,
        createdAt: sourceMetadataGet(raw, "identity-provider", sourceId),
        updatedAt: sourceMetadataGet(raw, "identity-provider", sourceId),
      }
      const prior = known.get(sourceId)
      if (prior !== undefined && (prior.name !== providerName || prior.authworksType !== authworksType)) {
        identityProvidersComplete = false
        ambiguous.add(sourceId)
        known.delete(sourceId)
        continue
      }
      if (prior === undefined && !ambiguous.has(sourceId)) {
        known.set(sourceId, provider)
        identityProviders.push(provider)
      }
    }
    for (const sourceId of ambiguous) {
      const index = identityProviders.findIndex((provider) => provider.sourceId === sourceId)
      if (index >= 0) identityProviders.splice(index, 1)
    }
  }
  const identityProviderById = new Map<string, (typeof identityProviders)[number]>()
  for (const provider of identityProviders) identityProviderById.set(provider.sourceId, provider)
  identityProviders.splice(0, identityProviders.length, ...identityProviderById.values())

  // Projects are paged globally. Filtering the request by every owner would make
  // the v2 API AND those filters and, more importantly, make pagination depend on
  // the locally selected organizations.
  const organizationIdSet = new Set(organizationIds)
  const projectsResult = await options.api.projectsList(organizationIds)
  if (!projectsResult.success) {
    complete.projects = false
    issues.push(zitadelMigrationResultIssueClassify("projects", projectsResult))
  }
  const projects: ZitadelMigrationSnapshot["projects"] = []
  for (const raw of projectsResult.success ? projectsResult.data : []) {
    const project = projectMap(raw)
    if (project === undefined) {
      skipped.push({ entity: "project", reason: "required-fields-missing", sourceId: sourceIdGet(raw) })
      continue
    }
    if (organizationIdSet.has(project.organizationId) && !projects.some((item) => item.id === project.id))
      projects.push(project)
  }

  const projectRoles: ZitadelMigrationSnapshot["projectRoles"] = []
  for (const project of projects) {
    const rolesResult = await options.api.projectRolesList(project.id, project.organizationId)
    if (!rolesResult.success) {
      complete.projectRoles = false
      issues.push(zitadelMigrationResultIssueClassify("projectRoles", rolesResult))
      continue
    }
    for (const raw of rolesResult.data) {
      const role = projectRoleMap(raw, project.id)
      if (role === undefined) {
        skipped.push({ entity: "projectRole", reason: "required-fields-missing", sourceId: sourceIdGet(raw) })
        continue
      }
      projectRoles.push(role)
    }
  }

  const grantsResult = await options.api.projectGrantsList(organizationIds)
  if (!grantsResult.success) {
    complete.projectGrants = false
    issues.push(zitadelMigrationResultIssueClassify("projectGrants", grantsResult))
  }
  const projectGrants: ZitadelMigrationSnapshot["projectGrants"] = []
  for (const raw of grantsResult.success ? grantsResult.data : []) {
    const grant = projectGrantMap(raw)
    if (grant === undefined) {
      skipped.push({ entity: "projectGrant", reason: "required-fields-missing", sourceId: sourceIdGet(raw) })
      continue
    }
    if (organizationIdSet.has(grant.organizationId) && !projectGrants.some((item) => item.id === grant.id))
      projectGrants.push(grant)
  }

  const oidcApplications: ZitadelMigrationSnapshot["oidcApplications"] = []
  for (const project of projects) {
    let applicationsResult: Result<Readonly<Record<string, unknown>>[]> = resultCreate([])
    if (options.api.projectApplicationsList === undefined) {
      complete.oidcApplications = false
      applicationsResult = resultCreate([])
    } else applicationsResult = await options.api.projectApplicationsList(project.id, project.organizationId)
    if (!applicationsResult.success) {
      complete.oidcApplications = false
      issues.push(zitadelMigrationResultIssueClassify("oidcApplications", applicationsResult))
      continue
    }
    for (const raw of applicationsResult.data) {
      const protocol = applicationProtocolGet(raw)
      if (protocol !== undefined && protocol !== "oidc") {
        complete.oidcApplications = false
        unsupported.push({
          entity: "oidcApplication",
          reason: "unsupported-application-protocol",
          sourceId: sourceIdGet(raw),
        })
        continue
      }
      const oidc = objectGet(raw.oidcConfig) ?? objectGet(raw.oidc) ?? objectGet(raw.oidcConfiguration)
      const missingFields = oidcApplicationMissingFields(raw, oidc)
      if (missingFields.length > 0) {
        skipped.push({
          entity: "oidcApplication",
          reason: missingReason(missingFields),
          sourceId: sourceIdGet(raw),
        })
        continue
      }
      const authMethod = enumNameGet(oidc?.authMethodType ?? oidc?.authMethod ?? raw.authMethodType ?? raw.authMethod)
      if (authMethodMap(authMethod) === undefined) {
        complete.oidcApplications = false
        unsupported.push({
          entity: "oidcApplication",
          reason: "unsupported-oidc-auth-method",
          sourceId: sourceIdGet(raw),
        })
        continue
      }
      const applicationType = oidcApplicationTypeGet(raw, oidc)
      if (applicationType !== undefined && oidcApplicationTypeMap(applicationType) === undefined) {
        complete.oidcApplications = false
        unsupported.push({
          entity: "oidcApplication",
          reason: "unsupported-oidc-application-type",
          sourceId: sourceIdGet(raw),
        })
        continue
      }
      for (const setting of oidcApplicationUnsupportedSettings(raw, oidc)) {
        complete.oidcApplications = false
        unsupported.push({
          entity: "oidcApplication",
          reason: `unsupported-oidc-setting:${setting}`,
          sourceId: sourceIdGet(raw),
        })
      }
      const application = oidcApplicationMap(raw, project.id)
      if (application === undefined) {
        skipped.push({
          entity: "oidcApplication",
          reason: "required-fields-missing",
          sourceId: sourceIdGet(raw),
        })
        continue
      }
      oidcApplications.push(application)
    }
  }

  for (const record of skipped) {
    const collection = collectionBySkippedEntity[record.entity]
    if (collection !== undefined) complete[collection] = false
  }
  const duplicateCollections = [
    ["users", users.map((item) => item.id)],
    ["organizations", organizations.map((item) => item.id)],
    ["projects", projects.map((item) => item.id)],
    ["projectRoles", projectRoles.map((item) => item.id)],
    ["projectGrants", projectGrants.map((item) => item.id)],
    ["machineUsers", machineUsers.map((item) => item.sourceId)],
    ["oidcApplications", oidcApplications.map((item) => item.sourceId)],
    ["externalIdentityLinks", externalIdentityLinks.map((item) => item.sourceId)],
    ["organizationMemberships", organizationMemberships.map((item) => item.id)],
    ["identityProviders", identityProviders.map((item) => item.sourceId)],
    ["loginPolicies", loginPolicies.map((item) => item.sourceId)],
  ] as const
  for (const [collection, ids] of duplicateCollections) {
    if (new Set(ids).size !== ids.length) complete[collection] = false
  }
  const roleKeys = projectRoles.map((item) => `${item.projectId}:${item.key}`)
  if (new Set(roleKeys).size !== roleKeys.length) complete.projectRoles = false

  const candidate: ZitadelMigrationSnapshot = {
    completeness: {
      users: { complete: complete.users ?? false, count: users.length },
      organizations: { complete: complete.organizations ?? false, count: organizations.length },
      organizationMemberships: {
        complete: complete.organizationMemberships ?? false,
        count: organizationMemberships.length,
      },
      projects: { complete: complete.projects ?? false, count: projects.length },
      projectRoles: { complete: complete.projectRoles ?? false, count: projectRoles.length },
      projectGrants: { complete: complete.projectGrants ?? false, count: projectGrants.length },
      domains: { complete: domainsComplete, count: domains.length },
      externalIdentityLinks: { complete: complete.externalIdentityLinks ?? true, count: externalIdentityLinks.length },
      identityProviders: { complete: identityProvidersComplete, count: identityProviders.length },
      loginPolicies: { complete: loginPoliciesComplete, count: loginPolicies.length },
      machineUsers: { complete: machineUsersComplete && (complete.machineUsers ?? false), count: machineUsers.length },
      oidcApplications: { complete: complete.oidcApplications ?? false, count: oidcApplications.length },
    },
    domains,
    exportedAt: 0,
    externalIdentityLinks,
    identityProviders,
    loginPolicies,
    machineUsers,
    oidcApplications,
    organizations,
    organizationMemberships,
    projectGrants,
    projectRoles,
    projects,
    unsupported,
    users,
    sourceInstance: "https://auth.contentoren.de",
    version: 2,
  }
  const parsed = v.safeParse(zitadelMigrationSnapshotSchema, candidate)
  if (!parsed.success)
    return resultErrorCodedCreate(
      "zitadelMigrationExport",
      "The ZITADEL export contained data Authworks cannot represent.",
      "zitadel-migration.source-invalid",
    )

  const report = migrationReportCreate(
    {
      users: users.length,
      organizations: organizations.length,
      organizationMemberships: organizationMemberships.length,
      projects: projects.length,
      projectRoles: projectRoles.length,
      projectGrants: projectGrants.length,
      oidcApplications: oidcApplications.length,
      machineUsers: machineUsers.length,
      domains: domains.length,
      loginPolicies: loginPolicies.length,
      identityProviders: identityProviders.length,
      externalIdentityLinks: externalIdentityLinks.length,
    },
    skipped,
    unsupported,
    issues,
  )
  return resultCreate({ report, snapshot: parsed.output })
}

function machineUserMap(
  raw: Readonly<Record<string, unknown>>,
): ZitadelMigrationSnapshot["machineUsers"][number] | undefined {
  const machine = objectGet(raw.machine)
  const id = stringGet(raw.id) ?? stringGet(raw.userId)
  const name = stringGet(machine?.name) ?? stringGet(raw.userName)
  const organizationId = stringGet(raw.organizationId) ?? stringGet(objectGet(raw.details)?.resourceOwner)
  if (machine === undefined || id === undefined || name === undefined || organizationId === undefined) return undefined
  const createdAt = timestampGet(raw.creationDate ?? raw.createdAt)
  const updatedAt = timestampGet(raw.changeDate ?? raw.updatedAt) ?? createdAt
  return {
    credentials: [{ available: false, portable: false, type: "machine-secret" }],
    ...(createdAt === undefined ? {} : { createdAt }),
    name,
    organizationId,
    sourceId: id,
    ...(updatedAt === undefined ? {} : { updatedAt }),
  }
}

function missingReason(fields: readonly string[]): string {
  return fields.length === 0 ? "required-fields-missing" : `required-fields-missing:${fields.join(",")}`
}

function machineUserMissingFields(raw: Readonly<Record<string, unknown>>): string[] {
  const machine = objectGet(raw.machine)
  const details = objectGet(raw.details)
  return [
    ...(stringGet(raw.id) === undefined && stringGet(raw.userId) === undefined ? ["id"] : []),
    ...(machine === undefined ? ["machine"] : []),
    ...(stringGet(machine?.name) === undefined && stringGet(raw.userName) === undefined ? ["name"] : []),
    ...(stringGet(raw.organizationId) === undefined && stringGet(details?.resourceOwner) === undefined
      ? ["organizationId"]
      : []),
  ]
}

function userMissingFields(raw: Readonly<Record<string, unknown>>): string[] {
  const human = objectGet(raw.human)
  const email = objectGet(human?.email)
  return [
    ...(human === undefined ? ["human"] : []),
    ...(stringGet(raw.id) === undefined ? ["id"] : []),
    ...(stringGet(raw.userName) === undefined ? ["userName"] : []),
    ...(stringGet(email?.email) === undefined ? ["email"] : []),
    ...(timestampGet(objectGet(raw.details)?.creationDate) === undefined ? ["creationDate"] : []),
    ...(timestampGet(objectGet(raw.details)?.changeDate) === undefined &&
    timestampGet(objectGet(raw.details)?.creationDate) === undefined
      ? ["changeDate"]
      : []),
    ...(userStateMap(raw.state) === undefined ? ["state"] : []),
  ]
}

function membershipMissingFields(raw: Readonly<Record<string, unknown>>): string[] {
  return [
    ...(stringGet(raw.userId) === undefined ? ["userId"] : []),
    ...(stringArrayGet(raw.roles) === undefined ? ["roles"] : []),
    ...(stringArrayGet(raw.roles)?.length === 0 ? ["roles"] : []),
    ...(timestampGet(objectGet(raw.details)?.creationDate) === undefined ? ["creationDate"] : []),
    ...(timestampGet(objectGet(raw.details)?.changeDate) === undefined &&
    timestampGet(objectGet(raw.details)?.creationDate) === undefined
      ? ["changeDate"]
      : []),
  ]
}

function oidcApplicationMissingFields(
  raw: Readonly<Record<string, unknown>>,
  oidc: Readonly<Record<string, unknown>> | undefined,
): string[] {
  const redirects = stringArrayGet(oidc?.redirectUris ?? raw.redirectUris)
  const authMethod = oidc?.authMethodType ?? oidc?.authMethod ?? raw.authMethodType ?? raw.authMethod
  return [
    ...(oidc === undefined ? ["oidcConfiguration"] : []),
    ...(stringGet(raw.id) === undefined && stringGet(raw.applicationId) === undefined ? ["applicationId"] : []),
    ...(stringGet(raw.name) === undefined ? ["name"] : []),
    ...(redirects === undefined || redirects.length === 0 ? ["redirectUris"] : []),
    ...(timestampGet(raw.creationDate ?? raw.createdAt) === undefined ? ["creationDate"] : []),
    ...(timestampGet(raw.changeDate ?? raw.updatedAt) === undefined &&
    timestampGet(raw.creationDate ?? raw.createdAt) === undefined
      ? ["changeDate"]
      : []),
    ...(applicationStatusMap(raw.state) === undefined ? ["state"] : []),
    ...(enumNameGet(authMethod) === undefined ? ["authMethodType"] : []),
  ]
}

function oidcApplicationMap(
  raw: Readonly<Record<string, unknown>>,
  projectId: string,
): ZitadelMigrationSnapshot["oidcApplications"][number] | undefined {
  const oidc = objectGet(raw.oidcConfig) ?? objectGet(raw.oidc) ?? objectGet(raw.oidcConfiguration)
  const sourceId = stringGet(raw.id) ?? stringGet(raw.applicationId)
  const name = stringGet(raw.name)
  const createdAt = timestampGet(raw.creationDate ?? raw.createdAt)
  const updatedAt = timestampGet(raw.changeDate ?? raw.updatedAt) ?? createdAt
  const redirects = stringArrayGet(oidc?.redirectUris ?? raw.redirectUris)
  const authMethod = enumNameGet(oidc?.authMethodType ?? oidc?.authMethod ?? raw.authMethodType ?? raw.authMethod)
  const applicationType = oidcApplicationTypeGet(raw, oidc)
  const status = applicationStatusMap(raw.state)
  if (
    oidc === undefined ||
    sourceId === undefined ||
    name === undefined ||
    redirects === undefined ||
    redirects.length === 0 ||
    createdAt === undefined ||
    updatedAt === undefined ||
    status === undefined ||
    (applicationType !== undefined && oidcApplicationTypeMap(applicationType) === undefined)
  )
    return undefined
  const tokenEndpointAuthMethod = authMethodMap(authMethod)
  if (tokenEndpointAuthMethod === undefined) return undefined
  const allowedScopes = stringArrayGet(oidc.allowedScopes ?? raw.allowedScopes)
  const requireConsent = booleanGet(oidc.requireConsent ?? raw.requireConsent)
  const trusted = booleanGet(oidc.trusted ?? raw.trusted)
  const compatibility = oidcApplicationCompatibilityMap(raw, oidc)
  return {
    accessTokenRoleAssertion: compatibility.accessTokenRoleAssertion,
    ...(allowedScopes === undefined ? {} : { allowedScopes }),
    additionalOrigins: compatibility.additionalOrigins,
    clientType: tokenEndpointAuthMethod === "none" ? "public" : "confidential",
    credentials: [{ available: false, portable: false, type: "client-secret" }],
    name,
    projectId,
    createdAt,
    redirectUris: redirects,
    ...(stringGet(oidc.clientId ?? raw.clientId) === undefined
      ? {}
      : { clientId: stringGet(oidc.clientId ?? raw.clientId) }),
    ...(stringArrayGet(oidc.postLogoutRedirectUris ?? raw.postLogoutRedirectUris) === undefined
      ? {}
      : { postLogoutRedirectUris: stringArrayGet(oidc.postLogoutRedirectUris ?? raw.postLogoutRedirectUris) }),
    ...(requireConsent === undefined ? {} : { requireConsent }),
    sourceId,
    tokenEndpointAuthMethod,
    ...(trusted === undefined ? {} : { trusted }),
    idTokenUserinfoAssertion: compatibility.idTokenUserinfoAssertion,
    updatedAt,
    status,
  }
}

function applicationProtocolGet(raw: Readonly<Record<string, unknown>>): string | undefined {
  const value = enumNameGet(raw.applicationType ?? raw.protocol ?? raw.type)
  const configuration = objectGet(raw.configuration)
  const configurationCase = stringGet(configuration?.case)
  if (
    value !== undefined &&
    [
      "OIDC",
      "oidc",
      "APPLICATION_TYPE_OIDC",
      "APPLICATION_TYPE_WEB",
      "APPLICATION_TYPE_NATIVE",
      "APPLICATION_TYPE_USER_AGENT",
      "__numeric_1",
    ].includes(value)
  )
    return "oidc"
  if (value === "API" || value === "api" || value === "APPLICATION_TYPE_API" || value === "__numeric_2") return "api"
  if (value === "SAML" || value === "saml" || value === "APPLICATION_TYPE_SAML" || value === "__numeric_3")
    return "saml"
  if (value === undefined && configurationCase !== undefined)
    return configurationCase.replace(/Configuration$/, "").toLowerCase()
  if (value === undefined && objectGet(raw.oidcConfig) !== undefined) return "oidc"
  return value
}

function enumNameGet(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (typeof value === "number" && Number.isInteger(value)) return `__numeric_${value}`
  return undefined
}

function authMethodMap(value: string | undefined): "none" | "client_secret_basic" | "client_secret_post" | undefined {
  if (
    value === "none" ||
    value === "OIDC_AUTH_METHOD_NONE" ||
    value === "OIDC_AUTH_METHOD_TYPE_NONE" ||
    value === "__numeric_2"
  )
    return "none"
  if (
    value === "client_secret_basic" ||
    value === "OIDC_AUTH_METHOD_BASIC" ||
    value === "OIDC_AUTH_METHOD_TYPE_BASIC" ||
    value === "__numeric_0"
  )
    return "client_secret_basic"
  if (
    value === "client_secret_post" ||
    value === "OIDC_AUTH_METHOD_POST" ||
    value === "OIDC_AUTH_METHOD_TYPE_POST" ||
    value === "__numeric_1"
  )
    return "client_secret_post"
  return undefined
}

function applicationStatusMap(value: unknown): "active" | "inactive" | "removed" | undefined {
  if (value === ApplicationState.ACTIVE || value === "APPLICATION_STATE_ACTIVE") return "active"
  if (value === ApplicationState.INACTIVE || value === "APPLICATION_STATE_INACTIVE") return "inactive"
  if (value === ApplicationState.REMOVED || value === "APPLICATION_STATE_REMOVED") return "removed"
  return value === "active" || value === "inactive" || value === "removed" ? value : undefined
}

function oidcApplicationTypeGet(
  raw: Readonly<Record<string, unknown>>,
  oidc: Readonly<Record<string, unknown>> | undefined,
): string | undefined {
  const configured = enumNameGet(oidc?.applicationType)
  if (configured !== undefined) return configured
  const protocol = enumNameGet(raw.applicationType)
  if (
    protocol === "OIDC" ||
    protocol === "oidc" ||
    protocol === "APPLICATION_TYPE_OIDC" ||
    protocol === "APPLICATION_TYPE_API" ||
    protocol === "APPLICATION_TYPE_SAML" ||
    protocol === "__numeric_1" ||
    protocol === "__numeric_2" ||
    protocol === "__numeric_3"
  )
    return undefined
  return protocol
}

function oidcApplicationTypeMap(value: string): "web" | "user_agent" | "native" | undefined {
  if (value === "OIDC_APP_TYPE_WEB" || value === "APPLICATION_TYPE_WEB" || value === "web" || value === "__numeric_0")
    return "web"
  if (
    value === "OIDC_APP_TYPE_USER_AGENT" ||
    value === "APPLICATION_TYPE_USER_AGENT" ||
    value === "user_agent" ||
    value === "__numeric_1"
  )
    return "user_agent"
  if (
    value === "OIDC_APP_TYPE_NATIVE" ||
    value === "APPLICATION_TYPE_NATIVE" ||
    value === "native" ||
    value === "__numeric_2"
  )
    return "native"
  return undefined
}

function oidcApplicationUnsupportedSettings(
  raw: Readonly<Record<string, unknown>>,
  oidc: Readonly<Record<string, unknown>> | undefined,
): readonly string[] {
  if (oidc === undefined) return []
  const unsupported: string[] = []
  if (enumArrayHasUnsupported(oidc.responseTypes, oidcResponseTypeMap)) unsupported.push("response-types")
  if (enumArrayHasUnsupported(oidc.grantTypes, oidcGrantTypeMap)) unsupported.push("grant-types")
  if (oidc.version !== undefined && oidcVersionMap(enumNameGet(oidc.version)) === undefined) unsupported.push("version")
  if (oidc.developmentMode === true) unsupported.push("development-mode")
  if (oidc.nonCompliant === true) unsupported.push("non-compliant")
  const compatibility = oidcApplicationCompatibilityMap(raw, oidc)
  unsupported.push(...compatibility.unsupported)
  if (oidc.idTokenRoleAssertion === true) unsupported.push("id-token-role-assertion")
  if (oidc.skipNativeAppSuccessPage === true) unsupported.push("skip-native-app-success-page")
  if (stringGet(oidc.backChannelLogoutUri) !== undefined) unsupported.push("back-channel-logout-uri")
  if (oidc.loginVersion !== undefined) unsupported.push("login-version")
  if (oidc.ios !== undefined) unsupported.push("ios-app-link")
  if (oidc.android !== undefined) unsupported.push("android-app-link")
  if (stringGet(oidc.authorizationEndpoint ?? raw.authorizationEndpoint) !== undefined)
    unsupported.push("authorization-endpoint")
  return unsupported
}

function oidcApplicationCompatibilityMap(
  raw: Readonly<Record<string, unknown>>,
  oidc: Readonly<Record<string, unknown>>,
): {
  readonly accessTokenRoleAssertion: boolean
  readonly additionalOrigins: string[]
  readonly idTokenUserinfoAssertion: boolean
  readonly unsupported: readonly string[]
} {
  const accessTokenRoleAssertionValue = oidcApplicationSettingGet(raw, oidc, "accessTokenRoleAssertion")
  const idTokenUserinfoAssertionValue = oidcApplicationSettingGet(raw, oidc, "idTokenUserinfoAssertion")
  const additionalOriginsValue = oidcApplicationSettingGet(raw, oidc, "additionalOrigins")
  const accessTokenRoleAssertion = booleanGet(accessTokenRoleAssertionValue)
  const idTokenUserinfoAssertion = booleanGet(idTokenUserinfoAssertionValue)
  const additionalOrigins = oidcAdditionalOriginsMap(additionalOriginsValue)
  return {
    accessTokenRoleAssertion: accessTokenRoleAssertion ?? false,
    additionalOrigins: additionalOrigins ?? [],
    idTokenUserinfoAssertion: idTokenUserinfoAssertion ?? false,
    unsupported: [
      ...(accessTokenRoleAssertionValue !== undefined && accessTokenRoleAssertion === undefined
        ? ["access-token-role-assertion"]
        : []),
      ...(idTokenUserinfoAssertionValue !== undefined && idTokenUserinfoAssertion === undefined
        ? ["id-token-userinfo-assertion"]
        : []),
      ...(additionalOriginsValue !== undefined && additionalOrigins === undefined ? ["additional-origins"] : []),
    ],
  }
}

function oidcApplicationSettingGet(
  raw: Readonly<Record<string, unknown>>,
  oidc: Readonly<Record<string, unknown>>,
  key: string,
): unknown {
  if (Object.hasOwn(oidc, key)) return oidc[key]
  return raw[key]
}

function oidcAdditionalOriginsMap(value: unknown): string[] | undefined {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 100) return undefined
  const origins: string[] = []
  for (const item of value) {
    if (typeof item !== "string") return undefined
    const valid = oidcOriginValidate(item)
    if (!valid.success || origins.includes(valid.data)) return undefined
    origins.push(valid.data)
  }
  return origins
}

function enumArrayHasUnsupported<T>(value: unknown, map: (value: string | undefined) => T | undefined): boolean {
  if (value === undefined) return false
  if (!Array.isArray(value)) return true
  return value.some((item) => map(enumNameGet(item)) === undefined)
}

function oidcResponseTypeMap(value: string | undefined): "code" | undefined {
  if (value === "code" || value === "OIDC_RESPONSE_TYPE_CODE" || value === "__numeric_1") return "code"
  return undefined
}

function oidcGrantTypeMap(value: string | undefined): "authorization_code" | "refresh_token" | undefined {
  if (value === "authorization_code" || value === "OIDC_GRANT_TYPE_AUTHORIZATION_CODE" || value === "__numeric_0")
    return "authorization_code"
  if (value === "refresh_token" || value === "OIDC_GRANT_TYPE_REFRESH_TOKEN" || value === "__numeric_2")
    return "refresh_token"
  return undefined
}

function oidcVersionMap(value: string | undefined): "1.0" | undefined {
  if (value === "1.0" || value === "OIDC_VERSION_1_0" || value === "__numeric_0") return "1.0"
  return undefined
}

function identityProviderMap(
  raw: Readonly<Record<string, unknown>>,
): ZitadelMigrationSnapshot["identityProviders"][number] | undefined {
  const sourceId = stringGet(raw.id)
  const name = stringGet(raw.name)
  const oidc = objectGet(raw.oidcConfig) ?? objectGet(raw.oidc)
  const saml = objectGet(raw.samlConfig) ?? objectGet(raw.saml)
  const providerValue = stringGet(raw.type) ?? stringGet(raw.provider)
  const authworksType = providerTypeMap(providerValue)
  const organizationId = stringGet(raw.organizationId)
  const owner = enumNameGet(raw.owner)
  const organizationOwner =
    owner === "__numeric_2" || owner === "IDP_OWNER_TYPE_ORG" || owner?.toLowerCase() === "organization"
  const systemOwner = owner === "__numeric_1" || owner === "IDP_OWNER_TYPE_SYSTEM" || owner?.toLowerCase() === "system"
  if (
    (organizationOwner && organizationId === undefined) ||
    (owner !== undefined && !organizationOwner && !systemOwner)
  )
    return undefined
  const provider =
    oidc !== undefined || providerValue === "OIDC" || providerValue === "oidc" || providerValue === "PROVIDER_TYPE_OIDC"
      ? "oidc"
      : saml !== undefined ||
          providerValue === "SAML" ||
          providerValue === "saml" ||
          providerValue === "PROVIDER_TYPE_SAML"
        ? "saml"
        : undefined
  const clientId = stringGet(oidc?.clientId) ?? stringGet(saml?.clientId) ?? stringGet(raw.clientId)
  if (sourceId === undefined || name === undefined || provider === undefined) return undefined
  const scopes = stringArrayGet(oidc?.scopes) ?? stringArrayGet(saml?.scopes)
  const allowAccountCreation =
    typeof raw.autoRegister === "boolean"
      ? raw.autoRegister
      : typeof raw.allowAccountCreation === "boolean"
        ? raw.allowAccountCreation
        : undefined
  const configuration =
    scopes === undefined && allowAccountCreation === undefined
      ? undefined
      : {
          ...(scopes === undefined ? {} : { scopes }),
          ...(allowAccountCreation === undefined ? {} : { allowAccountCreation }),
        }
  const createdAt = timestampGet(objectGet(raw.details)?.creationDate ?? raw.creationDate ?? raw.createdAt)
  const updatedAt = timestampGet(objectGet(raw.details)?.changeDate ?? raw.changeDate ?? raw.updatedAt) ?? createdAt
  return {
    ...(clientId === undefined ? {} : { clientId }),
    ...(configuration === undefined ? {} : { configuration }),
    name,
    provider,
    sourceId,
    ...(authworksType === undefined ? { authworksType: null } : { authworksType }),
    ...(organizationId === undefined ? {} : { organizationId }),
    ...(typeof raw.enabled === "boolean" ? { enabled: raw.enabled } : {}),
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(updatedAt === undefined ? {} : { updatedAt }),
  }
}

function providerTypeMap(value: string | undefined): "google" | "github" | "microsoft" | undefined {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "google" || normalized === "provider_type_google") return "google"
  if (normalized === "github" || normalized === "provider_type_github") return "github"
  if (
    normalized === "microsoft" ||
    normalized === "azure_ad" ||
    normalized === "provider_type_azure_ad" ||
    normalized === "provider_type_microsoft"
  )
    return "microsoft"
  return undefined
}

function policyProviderRefIdGet(raw: Readonly<Record<string, unknown>>): string | undefined {
  return stringGet(raw.id) ?? stringGet(raw.idpId) ?? stringGet(raw.identityProviderId)
}

function policyProviderRefNameGet(raw: Readonly<Record<string, unknown>>): string | undefined {
  return stringGet(raw.name) ?? stringGet(raw.providerName) ?? stringGet(raw.idpName)
}

function loginPolicyProviderRefsGet(raw: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>[] {
  const policy = objectGet(raw.policy)
  const refs = raw.idps ?? raw.identityProviders ?? policy?.idps ?? policy?.identityProviders
  if (!Array.isArray(refs)) return []
  return refs.flatMap((ref) => {
    if (typeof ref === "string") return []
    return objectGet(ref) === undefined ? [] : [objectGet(ref) as Readonly<Record<string, unknown>>]
  })
}

function externalIdentityLinkMap(
  raw: Readonly<Record<string, unknown>>,
  userId: string,
): ZitadelMigrationSnapshot["externalIdentityLinks"][number] | undefined {
  const identityProviderId = stringGet(raw.idpId) ?? stringGet(raw.identityProviderId)
  const externalSubject = stringGet(raw.userId) ?? stringGet(raw.subject) ?? stringGet(raw.externalSubject)
  const sourceId =
    stringGet(raw.id) ?? `zitadel-idp-link-${userId}-${identityProviderId ?? "unknown"}-${externalSubject ?? "unknown"}`
  if (identityProviderId === undefined || externalSubject === undefined) return undefined
  const createdAt = timestampGet(objectGet(raw.details)?.creationDate ?? raw.creationDate ?? raw.createdAt)
  const updatedAt = timestampGet(objectGet(raw.details)?.changeDate ?? raw.changeDate ?? raw.updatedAt) ?? createdAt
  return {
    externalSubject,
    identityProviderId,
    sourceId,
    userId,
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(updatedAt === undefined ? {} : { updatedAt }),
  }
}

function organizationMap(
  raw: Readonly<Record<string, unknown>>,
): ZitadelMigrationSnapshot["organizations"][number] | undefined {
  const id = stringGet(raw.id)
  const name = stringGet(raw.name)
  const sourceMetadata = sourceMetadataGet(raw, "organization", id)
  const createdAt = timestampGet(objectGet(raw.details)?.creationDate) ?? sourceMetadata
  const updatedAt = timestampGet(objectGet(raw.details)?.changeDate) ?? createdAt
  const status = organizationStatusMap(raw.state)
  if (id === undefined || name === undefined || status === undefined) return undefined
  return { createdAt, id, name, status, updatedAt }
}

function domainMap(
  raw: Readonly<Record<string, unknown>>,
  organizationId: string,
): ZitadelMigrationSnapshot["domains"][number] | undefined {
  const domain = stringGet(raw.domain)
  const sourceOrganizationId = stringGet(raw.organizationId) ?? organizationId
  const sourceId = stringGet(raw.id) ?? domain
  const createdAt = timestampGet(objectGet(raw.details)?.creationDate ?? raw.creationDate ?? raw.createdAt)
  const updatedAt = timestampGet(objectGet(raw.details)?.changeDate ?? raw.changeDate ?? raw.updatedAt) ?? createdAt
  if (domain === undefined || sourceId === undefined || sourceOrganizationId === undefined) return undefined
  return {
    domain: domain.toLowerCase(),
    isPrimary: raw.isPrimary === true,
    organizationId: sourceOrganizationId,
    sourceId,
    verified: raw.isVerified === true || raw.verified === true,
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(updatedAt === undefined ? {} : { updatedAt }),
  }
}

function loginPolicyMap(
  raw: Readonly<Record<string, unknown>>,
  organizationId: string,
): ZitadelMigrationSnapshot["loginPolicies"][number] | undefined {
  const allowUsernamePassword = raw.allowUsernamePassword
  const allowExternalIdp = raw.allowExternalIdp
  // Proto JSON omits false booleans.  Only apply that rule to an object that
  // is recognizably a login policy; an empty response is still malformed.
  const policyFields = [
    "allowUsernamePassword",
    "allowExternalIdp",
    "allowRegister",
    "forceMfa",
    "hideLoginName",
    "passwordCheckLifetime",
    "externalLoginCheckLifetime",
    "mfaInitSkipLifetime",
    "secondFactorCheckLifetime",
    "multifactorCheckLifetime",
  ]
  const recognized = policyFields.some((field) => field in raw)
  if (!recognized) return undefined
  if (
    (allowUsernamePassword !== undefined && typeof allowUsernamePassword !== "boolean") ||
    (allowExternalIdp !== undefined && typeof allowExternalIdp !== "boolean")
  )
    return undefined
  const createdAt = timestampGet(objectGet(raw.details)?.creationDate ?? raw.creationDate ?? raw.createdAt)
  const updatedAt = timestampGet(objectGet(raw.details)?.changeDate ?? raw.changeDate ?? raw.updatedAt) ?? createdAt
  return {
    allowExternalIdp: allowExternalIdp === true,
    allowUsernamePassword: allowUsernamePassword === true,
    organizationId,
    sourceId: organizationId,
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(updatedAt === undefined ? {} : { updatedAt }),
  }
}

function userMap(raw: Readonly<Record<string, unknown>>): ZitadelMigrationSnapshot["users"][number] | undefined {
  const human = objectGet(raw.human)
  const emailRecord = objectGet(human?.email)
  const profile = objectGet(human?.profile)
  const id = stringGet(raw.id)
  const userName = stringGet(raw.userName)
  const email = stringGet(emailRecord?.email)
  const createdAt = timestampGet(objectGet(raw.details)?.creationDate)
  const updatedAt = timestampGet(objectGet(raw.details)?.changeDate) ?? createdAt
  const state = userStateMap(raw.state)
  if (
    human === undefined ||
    id === undefined ||
    userName === undefined ||
    email === undefined ||
    createdAt === undefined ||
    updatedAt === undefined ||
    state === undefined
  )
    return undefined
  const emailVerified = emailRecord?.isEmailVerified === true
  return {
    createdAt,
    deletedAt: state === "deleted" ? updatedAt : null,
    email,
    emailVerified,
    emailVerifiedAt: emailVerified ? updatedAt : null,
    id,
    profile: {
      displayName: nullableStringGet(profile?.displayName),
      firstName: nullableStringGet(profile?.firstName),
      gender: nullableStringGet(profile?.gender),
      lastName: nullableStringGet(profile?.lastName),
      nickName: nullableStringGet(profile?.nickName),
      preferredLanguage: nullableStringGet(profile?.preferredLanguage),
    },
    state,
    updatedAt,
    userName,
  }
}

function organizationMembershipMap(
  raw: Readonly<Record<string, unknown>>,
  organizationId: string,
): ZitadelMigrationSnapshot["organizationMemberships"][number] | undefined {
  const userId = stringGet(raw.userId)
  const roles = stringArrayGet(raw.roles)
  const createdAt = timestampGet(objectGet(raw.details)?.creationDate)
  const updatedAt = timestampGet(objectGet(raw.details)?.changeDate) ?? createdAt
  if (
    userId === undefined ||
    roles === undefined ||
    roles.length === 0 ||
    createdAt === undefined ||
    updatedAt === undefined
  )
    return undefined
  return {
    createdAt,
    id: stringGet(raw.id) ?? `zitadel-membership-${organizationId}-${userId}`,
    organizationId,
    roles,
    updatedAt,
    userId,
  }
}

function projectMap(raw: Readonly<Record<string, unknown>>): ZitadelMigrationSnapshot["projects"][number] | undefined {
  const details = objectGet(raw.details)
  const id = stringGet(raw.projectId) ?? stringGet(raw.id)
  const organizationId = stringGet(raw.organizationId) ?? stringGet(details?.resourceOwner)
  const name = stringGet(raw.name)
  const sourceMetadata = sourceMetadataGet(raw, "project", id)
  const createdAt =
    timestampGet(raw.creationDate) ?? timestampGet(raw.creationDate ?? details?.creationDate) ?? sourceMetadata
  const updatedAt = timestampGet(raw.changeDate) ?? timestampGet(raw.changeDate ?? details?.changeDate) ?? createdAt
  const status = projectStatusMap(raw.state)
  if (id === undefined || organizationId === undefined || name === undefined || status === undefined) return undefined
  return {
    authorizationRequired:
      raw.authorizationRequired === true || raw.projectRoleAssertion === true || raw.projectRoleCheck === true,
    createdAt,
    id,
    name,
    organizationId,
    projectAccessRequired: raw.projectAccessRequired === true || raw.hasProjectCheck === true,
    status,
    updatedAt,
  }
}

function projectRoleMap(
  raw: Readonly<Record<string, unknown>>,
  projectId: string,
): ZitadelMigrationSnapshot["projectRoles"][number] | undefined {
  const details = objectGet(raw.details)
  const key = stringGet(raw.key)
  const displayName = stringGet(raw.displayName) ?? key
  const sourceMetadata = sourceMetadataGet(raw, "project-role", projectId)
  const createdAt = timestampGet(raw.creationDate ?? details?.creationDate) ?? sourceMetadata
  const updatedAt = timestampGet(raw.changeDate ?? details?.changeDate) ?? createdAt
  if (key === undefined || displayName === undefined) return undefined
  return {
    createdAt,
    displayName,
    group: nullableStringGet(raw.group),
    id: stringGet(raw.id) ?? `zitadel-role-${projectId}-${key}`,
    key,
    projectId,
    updatedAt,
  }
}

function projectGrantMap(
  raw: Readonly<Record<string, unknown>>,
): ZitadelMigrationSnapshot["projectGrants"][number] | undefined {
  const details = objectGet(raw.details)
  const id = stringGet(raw.grantId) ?? stringGet(raw.id)
  const projectId = stringGet(raw.projectId)
  const organizationId = stringGet(raw.organizationId) ?? stringGet(raw.projectOwnerId)
  const grantedOrganizationId = stringGet(raw.grantedOrganizationId) ?? stringGet(raw.grantedOrgId)
  const rawRoleKeys = raw.grantedRoleKeys ?? raw.roleKeys
  const roleKeys = rawRoleKeys === undefined ? [] : stringArrayGet(rawRoleKeys)
  const sourceMetadata = sourceMetadataGet(
    raw,
    "project-grant",
    id ?? `${organizationId}:${projectId}:${grantedOrganizationId}`,
  )
  const createdAt = timestampGet(raw.creationDate ?? details?.creationDate) ?? sourceMetadata
  const updatedAt = timestampGet(raw.changeDate ?? details?.changeDate) ?? createdAt
  const status = projectGrantStatusMap(raw.state)
  if (
    projectId === undefined ||
    organizationId === undefined ||
    grantedOrganizationId === undefined ||
    roleKeys === undefined ||
    status === undefined
  )
    return undefined
  return {
    createdAt,
    grantedOrganizationId,
    id: id ?? `zitadel-grant-${organizationId}-${projectId}-${grantedOrganizationId}`,
    organizationId,
    projectId,
    roleKeys,
    status,
    updatedAt,
  }
}

function organizationStatusMap(value: unknown): "active" | "inactive" | "removed" | undefined {
  if (value === OrganizationState.ACTIVE || value === "ORGANIZATION_STATE_ACTIVE") return "active"
  if (value === OrganizationState.INACTIVE || value === "ORGANIZATION_STATE_INACTIVE") return "inactive"
  if (value === OrganizationState.REMOVED || value === "ORGANIZATION_STATE_REMOVED") return "removed"
  return value === "active" || value === "inactive" || value === "removed" ? value : undefined
}

function userStateMap(
  value: unknown,
): "initial" | "active" | "inactive" | "locked" | "suspended" | "deleted" | undefined {
  if (value === UserState.ACTIVE || value === "USER_STATE_ACTIVE") return "active"
  if (value === UserState.INACTIVE || value === "USER_STATE_INACTIVE") return "inactive"
  if (
    value === UserState.DELETED ||
    value === UserState.REMOVED ||
    value === "USER_STATE_DELETED" ||
    value === "USER_STATE_REMOVED"
  )
    return "deleted"
  if (value === UserState.LOCKED || value === "USER_STATE_LOCKED") return "locked"
  if (value === UserState.INITIAL || value === "USER_STATE_INITIAL") return "initial"
  return value === "initial" ||
    value === "active" ||
    value === "inactive" ||
    value === "locked" ||
    value === "suspended" ||
    value === "deleted"
    ? value
    : undefined
}

function projectStatusMap(value: unknown): "active" | "inactive" | "removed" | undefined {
  if (value === ProjectState.ACTIVE || value === "PROJECT_STATE_ACTIVE") return "active"
  if (value === ProjectState.INACTIVE || value === "PROJECT_STATE_INACTIVE") return "inactive"
  return value === "active" || value === "inactive" || value === "removed" ? value : undefined
}

function projectGrantStatusMap(value: unknown): "active" | "inactive" | "removed" | undefined {
  if (value === GrantedProjectState.ACTIVE || value === "GRANTED_PROJECT_STATE_ACTIVE") return "active"
  if (value === GrantedProjectState.INACTIVE || value === "GRANTED_PROJECT_STATE_INACTIVE") return "inactive"
  return value === "active" || value === "inactive" || value === "removed" ? value : undefined
}

function migrationReportCreate(
  exported: Readonly<Record<string, number>>,
  skipped: readonly ZitadelMigrationSkippedRecord[],
  unsupported: readonly ZitadelMigrationSkippedRecord[],
  issues: readonly ZitadelMigrationIssue[],
): ZitadelMigrationExportReport {
  const counts: Record<string, ZitadelMigrationCount> = {}
  for (const entity of entities) {
    const count = exported[entity] ?? 0
    counts[entity] = {
      created: 0,
      deleted: 0,
      exported: count,
      imported: 0,
      seen: count,
      skipped: 0,
      unchanged: 0,
      updated: 0,
    }
  }
  const skippedByEntity = new Map<string, number>()
  for (const record of skipped) skippedByEntity.set(record.entity, (skippedByEntity.get(record.entity) ?? 0) + 1)
  for (const [entity, count] of skippedByEntity) {
    const key = entity.endsWith("s") ? entity : `${entity}s`
    const current = counts[key]
    if (current !== undefined)
      counts[key] = { ...current, skipped: current.skipped + count, seen: current.seen + count }
  }
  for (const record of unsupported) {
    const key = record.entity.endsWith("s") ? record.entity : `${record.entity}s`
    const current = counts[key]
    if (current !== undefined) counts[key] = { ...current, seen: current.seen + 1 }
  }
  return { counts, skipped, unsupported, issues }
}

function objectGet(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
  return value as Readonly<Record<string, unknown>>
}

function objectHasValue(object: unknown, key: string): boolean {
  const record = objectGet(object)
  return record !== undefined && record[key] !== undefined && record[key] !== null
}

function stringGet(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function nullableStringGet(value: unknown): string | null {
  return stringGet(value) ?? null
}

function booleanGet(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined
}

function stringArrayGet(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const result: string[] = []
  for (const item of value) {
    const string = stringGet(item)
    if (string === undefined) return undefined
    if (!result.includes(string)) result.push(string)
  }
  return result
}

function timestampGet(value: unknown): number | undefined {
  if (value instanceof Date) {
    const timestamp = value.getTime()
    return Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : undefined
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value
  if (typeof value === "string") {
    if (/^\d+(?:\.\d+)?$/.test(value)) {
      const numeric = Number(value)
      if (Number.isSafeInteger(numeric) && numeric >= 0) return numeric
    }
    const timestamp = Date.parse(value)
    if (Number.isSafeInteger(timestamp) && timestamp >= 0) return timestamp
  }
  const record = objectGet(value)
  if (record !== undefined) {
    const seconds =
      typeof record.seconds === "bigint" || typeof record.seconds === "string" || typeof record.seconds === "number"
        ? Number(record.seconds)
        : undefined
    const nanos =
      typeof record.nanos === "bigint" || typeof record.nanos === "string" || typeof record.nanos === "number"
        ? Number(record.nanos)
        : 0
    if (typeof seconds === "number" && Number.isSafeInteger(seconds) && seconds >= 0)
      return seconds * 1000 + Math.floor(nanos / 1_000_000)
  }
  return undefined
}

function sourceMetadataGet(
  raw: Readonly<Record<string, unknown>>,
  entity: string,
  fallbackId: string | undefined,
): number {
  const source = canonicalJsonGet(raw, new WeakSet<object>())
  const digest = createHash("sha256")
    .update(`${entity}:${fallbackId ?? ""}:${source}`)
    .digest("hex")
  return Number.parseInt(digest.slice(0, 12), 16) % Number.MAX_SAFE_INTEGER
}

function canonicalJsonGet(value: unknown, seen: WeakSet<object>): string {
  if (typeof value === "bigint") return JSON.stringify(value.toString())
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (typeof value !== "object" || value === null) return JSON.stringify(value)
  if (seen.has(value)) return '"[Circular]"'
  seen.add(value)
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJsonGet(item, seen)).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .filter((key) => !["creationDate", "changeDate", "createdAt", "updatedAt"].includes(key))
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJsonGet(record[key], seen)}`)
    .join(",")}}`
}

function sourceIdGet(raw: Readonly<Record<string, unknown>>): string {
  return stringGet(raw.id) ?? stringGet(raw.userId) ?? stringGet(raw.grantId) ?? "unknown"
}

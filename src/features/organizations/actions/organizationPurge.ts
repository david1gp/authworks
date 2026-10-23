import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventsPurge } from "../../../platform/storage/storageEventsPurge.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import { machineRepositoryCreate } from "../../machineUsers/persistence/machineRepositoryCreate.js"
import { projectDelete } from "../../projects/actions/projectDelete.js"
import { projectRepositoryCreate } from "../../projects/persistence/projectRepositoryCreate.js"
import { realmAdministratorContextAuthorize } from "../../realms/actions/realmAdministratorContextAuthorize.js"
import { realmAdministratorIs } from "../../realms/server/realmAdministratorIs.js"
import { organizationBrandingRepositoryCreate } from "../persistence/organizationBrandingRepositoryCreate.js"
import { organizationDomainRepositoryCreate } from "../persistence/organizationDomainRepositoryCreate.js"
import { organizationLoginPolicyRepositoryCreate } from "../persistence/organizationLoginPolicyRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"

type OrganizationPurgeOptions = {
  readonly actor: AuthorizationActorContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
}

// Org purge: org must already be `removed`. Deletes owned projects first via
// the projects server surface path (projectDelete over a tenant context so
// project child rows and project.deleted events are handled by the projects
// feature), then purges org events plus all cascaded aggregate events, then
// deletes the org row (FK cascades remove remaining children). Appends NO
// new event: purge removes the org's audit trail.
export function organizationPurge(
  options: OrganizationPurgeOptions,
): Result<{ projectsDeleted: number; purged: boolean }> {
  const op = "organizationPurge"
  const authorized = realmAdministratorContextAuthorize({
    actor: options.actor,
    database: options.database,
    permission: authorizationPermissionDefinitions.realmPurge,
    realmId: options.realmId,
  })
  if (!authorized.success) return authorized
  const administrator = realmAdministratorOrBootstrap(options.actor, options.database, options.realmId)
  if (!administrator.success) return administrator
  if (!administrator.data)
    return resultErrorCreate(op, "Only realm administrators can purge organizations.", "organizations.forbidden")
  const context = authorized.data

  // Check removed-status BEFORE deleting anything: a premature 409 must not
  // have side effects.
  const current = organizationRepositoryCreate(options.database.db).organizationGet(options.organizationId)
  if (!current.success) return current
  if (current.data === null || current.data.realmId !== options.realmId)
    return resultErrorCreate(op, "The organization was not found.", "organizations.not-found")
  if (current.data.status !== "removed")
    return resultErrorCreate(op, "Only removed organizations can be purged.", "organizations.purge-not-removed")

  const preAggregates = organizationPurgeAggregateIdsRead(options.database.db, options.realmId, options.organizationId)
  if (!preAggregates.success) return preAggregates
  const owned = organizationPurgeOwnedProjectsRead(options.database, options.realmId, options.organizationId)
  if (!owned.success) return owned
  let projectsDeleted = 0
  for (const project of owned.data) {
    const deleted = projectDelete({
      context,
      database: options.database,
      projectId: project.id,
      realmId: options.realmId,
    })
    if (!deleted.success) return deleted
    if (deleted.data.deleted) projectsDeleted += 1
  }
  return storageTransactionRun(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const refreshed = repository.organizationGet(options.organizationId)
    if (!refreshed.success) return refreshed
    if (refreshed.data === null || refreshed.data.realmId !== options.realmId)
      return resultErrorCreate(op, "The organization was not found.", "organizations.not-found")
    if (refreshed.data.status !== "removed")
      return resultErrorCreate(op, "Only removed organizations can be purged.", "organizations.purge-not-removed")
    const aggregates = preAggregates
    // projectDelete already purged owned-project aggregates via the
    // projects surface; delete leftover rows first so no FK-compliant event
    // rows reference aggregates we are about to purge.
    const events = storageEventsPurge(transaction, aggregates.data)
    if (!events.success) return events
    const deleted = repository.organizationDelete(options.realmId, options.organizationId)
    if (!deleted.success) return deleted
    if (deleted.data === null)
      return resultErrorCreate(op, "The organization was not found.", "organizations.not-found")
    return resultCreate({ projectsDeleted, purged: true })
  })
}

function realmAdministratorOrBootstrap(
  actor: AuthorizationActorContext,
  database: StorageDatabase,
  realmId: string,
): Result<boolean> {
  if (actor.kind === "bootstrap_admin") return resultCreate(true)
  if (actor.kind !== "user") return resultCreate(false)
  const administrator = realmAdministratorIs({ database, realmId, userId: actor.actorId })
  if (!administrator.success) return administrator
  return resultCreate(administrator.data)
}

function organizationPurgeOwnedProjectsRead(
  database: StorageDatabase,
  realmId: string,
  organizationId: string,
): Result<readonly { id: string; status: string }[]> {
  const repository = projectRepositoryCreate(database.db)
  const projects = repository.projectList(realmId)
  if (!projects.success) return projects
  return resultCreate(projects.data.filter((project) => project.organizationId === organizationId))
}

function organizationPurgeAggregateIdsRead(
  executor: StorageExecutor,
  realmId: string,
  organizationId: string,
): Result<string[]> {
  try {
    const optionsRealmId = realmId
    const ids = new Set<string>([organizationId])
    const memberships = organizationRepositoryCreate(executor).organizationMembershipList(organizationId)
    if (!memberships.success) return memberships
    for (const membership of memberships.data) ids.add(membership.id)
    const invitations = organizationRepositoryCreate(executor).organizationInvitationList(organizationId)
    if (!invitations.success) return invitations
    for (const invitation of invitations.data) ids.add(invitation.id)
    const domains = organizationDomainRepositoryCreate(executor).organizationDomainList(organizationId)
    if (!domains.success) return domains
    for (const domain of domains.data) ids.add(domain.domain)
    const branding = organizationBrandingRepositoryCreate(executor).organizationBrandingGet(organizationId)
    if (!branding.success) return branding
    if (branding.data !== null) ids.add(organizationId)
    const policy = organizationLoginPolicyRepositoryCreate(executor).organizationLoginPolicyGet(organizationId)
    if (!policy.success) return policy
    if (policy.data !== null) ids.add(organizationId)
    const machines = machineRepositoryCreate(executor).userList(optionsRealmId, organizationId)
    if (!machines.success) return machines
    for (const machine of machines.data) ids.add(machine.id)
    const credentials = machineRepositoryCreate(executor).credentialListForOrganization(optionsRealmId, organizationId)
    if (!credentials.success) return credentials
    for (const credential of credentials.data) ids.add(credential.id)
    const projects = projectRepositoryCreate(executor).projectList(optionsRealmId)
    if (!projects.success) return projects
    for (const project of projects.data) {
      if (project.organizationId !== organizationId) continue
      ids.add(project.id)
      const applications = projectRepositoryCreate(executor).projectApplicationList(project.id)
      if (!applications.success) return applications
      for (const application of applications.data) ids.add(application.id)
      const roles = projectRepositoryCreate(executor).projectRoleList(project.id)
      if (!roles.success) return roles
      for (const role of roles.data) ids.add(role.id)
      const grants = projectRepositoryCreate(executor).projectGrantList(project.id)
      if (!grants.success) return grants
      for (const grant of grants.data) ids.add(grant.id)
      const assignments = projectRepositoryCreate(executor).projectUserAssignmentList(optionsRealmId, project.id)
      if (!assignments.success) return assignments
      for (const assignment of assignments.data) ids.add(assignment.id)
    }
    return resultCreate([...ids])
  } catch (_error) {
    return resultErrorCreate(
      "organizationPurge",
      "The organization aggregates could not be collected.",
      "organizations.read-failed",
    )
  }
}

// Machine users/credentials and projects are handled through the feature
// surfaces above (projectDelete over tenant context; row deletes below rely
// on FK cascades). Their aggregates are collected here so their events are
// purged even when the rows are already gone.

import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { authorizationRoleKeysResolve } from "../../authorization/actions/authorizationRoleKeysResolve.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"
import { organizationSubjectMembershipList } from "../../organizations/server/organizationSubjectMembershipList.js"
import { userRepositoryCreate } from "../../users/persistence/userRepositoryCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { ProjectRow } from "../persistence/projectTable.js"
import { projectSubjectProjectRoleResolve } from "./projectSubjectProjectRoleResolve.js"

type ProjectOidcContextValidateOptions = {
  readonly applicationId?: string | null
  readonly executor: StorageExecutor
  readonly organizationId?: string | null
  readonly projectId?: string | null
  readonly realmId: string
  readonly userId?: string
}

export function projectOidcContextValidate(options: ProjectOidcContextValidateOptions): Result<void> {
  const op = "projectOidcContextValidate"
  const repository = projectRepositoryCreate(options.executor)
  const applicationId = options.applicationId ?? undefined
  const requestedProjectId = options.projectId ?? undefined
  let projectId = requestedProjectId

  if (applicationId !== undefined) {
    const application = repository.projectApplicationGet(applicationId)
    if (!application.success) return application
    if (
      application.data === null ||
      application.data.realmId !== options.realmId ||
      application.data.status !== "active" ||
      application.data.applicationType !== "oidc"
    )
      return projectOidcContextInvalid(op)
    if (projectId !== undefined && application.data.projectId !== projectId) return projectOidcContextInvalid(op)
    projectId = application.data.projectId
  }

  if (projectId === undefined) return resultCreate(undefined)
  const project = repository.projectGet(projectId)
  if (!project.success) return project
  const projectData = project.data
  if (projectData === null || projectData.realmId !== options.realmId || projectData.status !== "active")
    return projectOidcContextInvalid(op)

  if (options.organizationId === undefined) return resultCreate(undefined)
  if (options.organizationId === null) return projectOidcContextInvalid(op)
  const organization = organizationLoginContextValidate({
    context: { organizationId: options.organizationId, realmId: options.realmId },
    executor: options.executor,
    expectedOrganizationId: options.organizationId,
    expectedRealmId: options.realmId,
  })
  if (!organization.success) return projectOidcContextInvalid(op)
  if (projectData.organizationId === options.organizationId) {
    return projectOidcAuthorizationEnforce({
      executor: options.executor,
      project: projectData,
      realmId: options.realmId,
      userId: options.userId,
    })
  }

  const grant = repository.projectGrantGetByProjectOrganization(projectData.id, options.organizationId)
  if (!grant.success) return grant
  if (
    grant.data === null ||
    grant.data.realmId !== options.realmId ||
    grant.data.projectId !== projectData.id ||
    grant.data.organizationId !== projectData.organizationId ||
    grant.data.grantedOrganizationId !== options.organizationId ||
    grant.data.status !== "active"
  )
    return projectOidcContextInvalid(op)
  return projectOidcAuthorizationEnforce({
    executor: options.executor,
    project: projectData,
    realmId: options.realmId,
    userId: options.userId,
  })
}

function projectOidcAuthorizationEnforce(options: {
  readonly executor: StorageExecutor
  readonly project: ProjectRow
  readonly realmId: string
  readonly userId?: string
}): Result<void> {
  const op = "projectOidcContextValidate"
  if (options.project.authorizationRequired !== 1 && options.project.projectAccessRequired !== 1)
    return resultCreate(undefined)
  const userId = options.userId
  if (userId === undefined) return resultCreate(undefined)
  if (userId.length === 0) return projectOidcContextInvalid(op)
  const user = userRepositoryCreate(options.executor).userGet(options.realmId, userId)
  if (!user.success) return user
  if (user.data === null || user.data.state !== "active" || user.data.deletedAt !== null)
    return projectOidcContextInvalid(op)
  if (options.project.authorizationRequired === 1) {
    const authorized = projectOidcAuthorizationCheck({
      executor: options.executor,
      project: options.project,
      realmId: options.realmId,
      userId,
    })
    if (!authorized.success) return authorized
    if (!authorized.data) return projectOidcContextInvalid(op)
  }
  if (options.project.projectAccessRequired === 1) {
    const roles = projectSubjectProjectRoleResolve({
      executor: options.executor,
      projectId: options.project.id,
      realmId: options.realmId,
      userId,
    })
    if (!roles.success) return roles
    if (roles.data.length === 0) return projectOidcContextInvalid(op)
  }
  return resultCreate(undefined)
}

function projectOidcAuthorizationCheck(options: {
  readonly executor: StorageExecutor
  readonly project: ProjectRow
  readonly realmId: string
  readonly userId: string
}): Result<boolean> {
  const repository = projectRepositoryCreate(options.executor)
  const assignment = repository.projectUserAssignmentGetByProjectUser(
    options.realmId,
    options.project.id,
    options.userId,
  )
  if (!assignment.success) return assignment
  if (assignment.data !== null) return resultCreate(true)
  const grants = repository.projectGrantList(options.project.id)
  if (!grants.success) return grants
  const memberships = organizationSubjectMembershipList({
    executor: options.executor,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!memberships.success) return memberships
  for (const grant of grants.data) {
    if (
      grant.realmId !== options.realmId ||
      grant.projectId !== options.project.id ||
      grant.organizationId !== options.project.organizationId ||
      grant.grantedOrganizationId === options.project.organizationId ||
      grant.status !== "active"
    )
      continue
    const membership = memberships.data.find((candidate) => candidate.organizationId === grant.grantedOrganizationId)
    if (membership === undefined) continue
    const access = authorizationRoleKeysResolve({ roles: membership.roles })
    if (!access.success) return access
    if (access.data.permissions.includes("project.read")) return resultCreate(true)
  }
  return resultCreate(false)
}

function projectOidcContextInvalid(op: string): Result<never> {
  // The code stays in the projects namespace even though every consumer lives in
  // the OIDC feature: protocol error mapping keys on op (or falls back to
  // invalid_request) and the item-12 denial message stays generic, so the
  // wire response is unchanged. Management callers (oidcClientCreate/Update)
  // propagate this code with the same 400 status as before.
  return resultErrorCodedCreate(op, "The OIDC client context is invalid.", "projects.invalid")
}

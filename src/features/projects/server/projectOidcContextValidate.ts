import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationLoginContextValidate } from "../../organizations/server/organizationLoginContextValidate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"

type ProjectOidcContextValidateOptions = {
  readonly applicationId?: string | null
  readonly executor: StorageExecutor
  readonly organizationId?: string | null
  readonly projectId?: string | null
  readonly realmId: string
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
  if (projectData.organizationId === options.organizationId) return resultCreate(undefined)

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
  return resultCreate(undefined)
}

function projectOidcContextInvalid(op: string): Result<never> {
  return resultErrorCodedCreate(op, "The OIDC client context is invalid.", "oidc.invalid")
}

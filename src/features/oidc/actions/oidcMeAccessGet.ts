import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationRepositoryCreate } from "../../organizations/persistence/organizationRepositoryCreate.js"
import { organizationPrimaryDomainResolve } from "../../organizations/server/organizationPrimaryDomainResolve.js"
import { organizationSubjectMembershipList } from "../../organizations/server/organizationSubjectMembershipList.js"
import { projectRepositoryCreate } from "../../projects/persistence/projectRepositoryCreate.js"
import { projectSubjectProjectRoleResolve } from "../../projects/server/projectSubjectProjectRoleResolve.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import type { OidcMeAccessResponse } from "../public/oidcMeAccessResponseSchema.js"
import { oidcAccessTokenContextResolve } from "./oidcAccessTokenContextResolve.js"

type OidcMeAccessGetOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
}

export function oidcMeAccessGet(options: OidcMeAccessGetOptions): Result<OidcMeAccessResponse> {
  const context = oidcAccessTokenContextResolve({
    database: options.database,
    realmId: options.realmId,
    ...(options.runtime === undefined ? {} : { runtime: options.runtime }),
    token: options.token,
  })
  if (!context.success) return context
  if (context.data.client.trusted !== 1)
    return resultErrorCreate("oidcMeAccessInsufficientScope", "The client is not authorized for this resource.")

  const memberships = organizationSubjectMembershipList({
    executor: options.database.db,
    realmId: options.realmId,
    userId: context.data.user.id,
  })
  if (!memberships.success) return memberships

  const organizationRepository = organizationRepositoryCreate(options.database.db)
  const organizations: OidcMeAccessResponse["organizations"] = []
  for (const membership of memberships.data) {
    const organization = organizationRepository.organizationGet(membership.organizationId)
    if (!organization.success) return organization
    if (
      organization.data === null ||
      organization.data.realmId !== options.realmId ||
      organization.data.status !== "active"
    )
      continue
    const primaryDomain = organizationPrimaryDomainResolve({
      executor: options.database.db,
      organizationId: membership.organizationId,
      realmId: options.realmId,
    })
    if (!primaryDomain.success) return primaryDomain
    organizations.push({
      id: membership.organizationId,
      name: organization.data.name,
      primaryDomain: primaryDomain.data ?? null,
      roles: membership.roles,
    })
  }

  const projects = projectRepositoryCreate(options.database.db).projectList(options.realmId)
  if (!projects.success) return projects
  const projectRoles: OidcMeAccessResponse["projectRoles"] = []
  for (const project of projects.data) {
    if (project.realmId !== options.realmId || project.status !== "active") continue
    const resolved = projectSubjectProjectRoleResolve({
      executor: options.database.db,
      projectId: project.id,
      realmId: options.realmId,
      userId: context.data.user.id,
    })
    if (!resolved.success) {
      if (resolved.code === "projects.not-found") continue
      return resolved
    }
    for (const entry of resolved.data)
      projectRoles.push({ organizationId: entry.organizationId, projectId: project.id, roleKeys: entry.roleKeys })
  }
  projectRoles.sort(
    (left, right) =>
      left.projectId.localeCompare(right.projectId) || left.organizationId.localeCompare(right.organizationId),
  )

  return resultCreate({ organizations, projectRoles, sub: context.data.user.id })
}

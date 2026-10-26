import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectPublicViewCreate } from "../domain/projectPublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { ProjectListItem } from "../public/projectListItemSchema.js"
import type { ProjectListQuery } from "../public/projectListQuerySchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly query?: ProjectListQuery
  readonly realmId: string
  readonly organizationId?: string
  readonly grantedToOrganizationId?: string
}

export function projectList(options: ProjectListOptions): Result<{ items: ProjectListItem[]; nextPageToken?: string }> {
  const op = "projectList"
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The projects are not available in this tenant context.",
      "projects.tenant-mismatch",
    )
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id"], "createdAt")
  if (!sortBy.success) return sortBy
  const organizationFilter = options.organizationId ?? options.grantedToOrganizationId
  const repository = projectRepositoryCreate(options.database.db)
  const rows = repository.projectList(options.realmId)
  if (!rows.success) return rows
  const grantedProjectIds = new Set<string>()
  if (organizationFilter !== undefined) {
    const grants = repository.projectGrantActiveListByGrantedOrganization(options.realmId, organizationFilter)
    if (!grants.success) return grants
    for (const grant of grants.data) grantedProjectIds.add(grant.projectId)
  }
  const status = options.query?.status ?? "active"
  const search = options.query?.search?.trim().toLowerCase()
  const views: { project: ProjectListItem }[] = []
  for (const project of rows.data) {
    if (project.status === "removed") continue
    if (status !== "all" && project.status !== status) continue
    if (search !== undefined && search.length > 0) {
      if (!`${project.name} ${project.id}`.toLowerCase().includes(search)) continue
    }
    if (
      organizationFilter !== undefined &&
      project.organizationId !== organizationFilter &&
      !grantedProjectIds.has(project.id)
    )
      continue
    if (options.context.kind === "system") {
      views.push({ project: projectPublicViewCreate(project) })
      continue
    }
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
      permission: "project.read",
      project,
    })
    if (authorized.success) views.push({ project: projectPublicViewCreate(project) })
  }
  const page = listRowsPage({
    idGet: (entry) => entry.project.id,
    query: options.query,
    rows: views,
    sortValueGet: (entry) => (sortBy.data === "id" ? entry.project.id : entry.project.createdAt),
  })
  if (!page.success) return page
  const pageIds = page.data.items.map((entry) => entry.project.id)
  const roleCounts = repository.projectRoleCountByProject(pageIds)
  if (!roleCounts.success) return roleCounts
  const applicationCounts = repository.projectApplicationCountByProject(pageIds)
  if (!applicationCounts.success) return applicationCounts
  const roleCountByProject = new Map(roleCounts.data.map((entry) => [entry.projectId, entry.total]))
  const applicationCountByProject = new Map(applicationCounts.data.map((entry) => [entry.projectId, entry.total]))
  return resultCreate({
    ...(page.data.nextPageToken === undefined ? {} : { nextPageToken: page.data.nextPageToken }),
    items: page.data.items.map((entry) => ({
      ...entry.project,
      applicationCount: applicationCountByProject.get(entry.project.id) ?? 0,
      roleCount: roleCountByProject.get(entry.project.id) ?? 0,
    })),
  })
}

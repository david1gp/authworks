import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectGrantPublicViewCreate } from "../domain/projectGrantPublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { ProjectGrant } from "../public/projectGrantSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectGrantListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly projectId: string
  readonly query?: ListQuery
}

export function projectGrantList(
  options: ProjectGrantListOptions,
): Result<{ items: ProjectGrant[]; nextPageToken?: string }> {
  const op = "projectGrantList"
  const repository = projectRepositoryCreate(options.database.db)
  const project = repository.projectGet(options.projectId)
  if (!project.success) return project
  if (project.data === null || project.data.realmId !== options.realmId || project.data.status !== "active")
    return resultErrorCodedCreate(op, "The project was not found.", "projects.not-found")
  const authorized = projectContextAuthorize({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
    permission: "project.grant.read",
    project: project.data,
  })
  if (!authorized.success) return authorized
  const rows = repository.projectGrantList(options.projectId)
  if (!rows.success) return rows
  const grants: ProjectGrant[] = []
  for (const row of rows.data) {
    if (row.status === "removed") continue
    const view = projectGrantPublicViewCreate(row)
    if (!view.success) return view
    grants.push(view.data)
  }
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id"], "createdAt")
  if (!sortBy.success) return sortBy
  return listRowsPage({
    idGet: (grant) => grant.id,
    query: options.query,
    rows: grants,
    sortValueGet: (grant) => (sortBy.data === "id" ? grant.id : grant.createdAt),
  })
}

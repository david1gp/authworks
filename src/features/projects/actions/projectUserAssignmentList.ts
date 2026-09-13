import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectUserAssignmentPublicViewCreate } from "../domain/projectUserAssignmentPublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { ProjectUserAssignment } from "../public/projectUserAssignmentSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectUserAssignmentListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly projectId: string
  readonly query?: ListQuery
  readonly realmId: string
}

export function projectUserAssignmentList(
  options: ProjectUserAssignmentListOptions,
): Result<{ items: ProjectUserAssignment[]; nextPageToken?: string }> {
  const op = "projectUserAssignmentList"
  const repository = projectRepositoryCreate(options.database.db)
  const project = repository.projectGet(options.projectId)
  if (!project.success) return project
  if (project.data === null || project.data.realmId !== options.realmId || project.data.status !== "active")
    return resultErrorCodedCreate(op, "The project was not found.", "projects.not-found")
  const authorized = projectContextAuthorize({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
    permission: "project.write",
    project: project.data,
  })
  if (!authorized.success) return authorized
  const rows = repository.projectUserAssignmentList(options.realmId, options.projectId)
  if (!rows.success) return rows
  const assignments: ProjectUserAssignment[] = []
  for (const row of rows.data) {
    const view = projectUserAssignmentPublicViewCreate(row)
    if (!view.success) return view
    assignments.push(view.data)
  }
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id"], "createdAt")
  if (!sortBy.success) return sortBy
  return listRowsPage({
    idGet: (assignment) => assignment.id,
    query: options.query,
    rows: assignments,
    sortValueGet: (assignment) => (sortBy.data === "id" ? assignment.id : assignment.createdAt),
  })
}

import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectApplicationPublicViewCreate } from "../domain/projectApplicationPublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { ProjectApplication } from "../public/projectApplicationSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectApplicationListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly projectId: string
  readonly query?: ListQuery
}

export function projectApplicationList(
  options: ProjectApplicationListOptions,
): Result<{ items: ProjectApplication[]; nextPageToken?: string }> {
  const op = "projectApplicationList"
  const repository = projectRepositoryCreate(options.database.db)
  const project = repository.projectGet(options.projectId)
  if (!project.success) return project
  if (project.data === null || project.data.realmId !== options.realmId || project.data.status !== "active")
    return resultErrorCodedCreate(op, "The project was not found.", "projects.not-found")
  const authorized = projectContextAuthorize({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
    permission: "project.app.read",
    project: project.data,
  })
  if (!authorized.success) return authorized
  const rows = repository.projectApplicationList(options.projectId)
  if (!rows.success) return rows
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id"], "createdAt")
  if (!sortBy.success) return sortBy
  const applications = rows.data
    .filter((application) => application.status === "active")
    .map(projectApplicationPublicViewCreate)
  return listRowsPage({
    idGet: (application) => application.id,
    query: options.query,
    rows: applications,
    sortValueGet: (application) => (sortBy.data === "id" ? application.id : application.createdAt),
  })
}

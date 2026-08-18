import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"
import { projectPublicViewCreate } from "../domain/projectPublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { Project } from "../public/projectSchema.js"

type ProjectListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly query?: ListQuery
  readonly realmId: string
}

export function projectList(options: ProjectListOptions): Result<{ items: Project[]; nextPageToken?: string }> {
  const op = "projectList"
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The projects are not available in this tenant context.",
      "projects.tenant-mismatch",
    )
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id"], "createdAt")
  if (!sortBy.success) return sortBy
  const rows = projectRepositoryCreate(options.database.db).projectList(options.realmId)
  if (!rows.success) return rows
  const projects: Project[] = []
  for (const project of rows.data) {
    if (project.status !== "active") continue
    if (options.context.kind === "system") {
      projects.push(projectPublicViewCreate(project))
      continue
    }
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
      permission: "project.read",
      project,
    })
    if (authorized.success) projects.push(projectPublicViewCreate(project))
  }
  return listRowsPage({
    idGet: (project) => project.id,
    query: options.query,
    rows: projects,
    sortValueGet: (project) => (sortBy.data === "id" ? project.id : project.createdAt),
  })
}

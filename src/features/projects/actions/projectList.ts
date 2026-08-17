import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"
import { projectPublicViewCreate } from "../domain/projectPublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { Project } from "../public/projectSchema.js"

type ProjectListOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
}

export function projectList(options: ProjectListOptions): Result<{ projects: Project[] }> {
  const op = "projectList"
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The projects are not available in this tenant context.")
  const rows = projectRepositoryCreate(options.database.db).projectList(options.instanceId)
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
      instanceId: options.instanceId,
      permission: "project.read",
      project,
    })
    if (authorized.success) projects.push(projectPublicViewCreate(project))
  }
  return resultCreate({ projects })
}

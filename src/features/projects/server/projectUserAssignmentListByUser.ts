import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { projectRoleKeysDecode } from "../domain/projectRoleKeysDecode.js"
import { projectUserAssignmentPublicViewCreate } from "../domain/projectUserAssignmentPublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { Project } from "../public/projectSchema.js"
import type { ProjectUserAssignment } from "../public/projectUserAssignmentSchema.js"
import type { ProjectUserAssignmentRole } from "./projectUserAssignmentRoleSchema.js"

export type ProjectUserAssignmentListByUserEntry = {
  readonly assignment: ProjectUserAssignment
  readonly project: Pick<Project, "id" | "name" | "organizationId" | "status">
  readonly roles: readonly ProjectUserAssignmentRole[]
}

type ProjectUserAssignmentListByUserOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
}

export function projectUserAssignmentListByUser(
  options: ProjectUserAssignmentListByUserOptions,
): Result<readonly ProjectUserAssignmentListByUserEntry[]> {
  const op = "projectUserAssignmentListByUser"
  if (options.realmId.length === 0 || options.userId.length === 0)
    return resultErrorCodedCreate(op, "The project assignment lookup is invalid.", "projects.invalid")
  const repository = projectRepositoryCreate(options.database.db)
  const assignments = repository.projectUserAssignmentListByUser(options.realmId, options.userId)
  if (!assignments.success) return assignments
  const entries: ProjectUserAssignmentListByUserEntry[] = []
  for (const assignment of assignments.data) {
    const view = projectUserAssignmentPublicViewCreate(assignment)
    if (!view.success) return view
    const roleKeys = projectRoleKeysDecode(assignment.roleKeys)
    if (!roleKeys.success) return roleKeys
    const project = repository.projectGet(assignment.projectId)
    if (!project.success) return project
    if (project.data === null || project.data.realmId !== options.realmId || project.data.status !== "active") continue
    const roles = repository.projectRoleList(assignment.projectId)
    if (!roles.success) return roles
    const definitions = new Map(
      roles.data
        .filter((role) => role.realmId === options.realmId && role.projectId === assignment.projectId)
        .map((role) => [role.key, role.displayName]),
    )
    entries.push({
      assignment: view.data,
      project: {
        id: project.data.id,
        name: project.data.name,
        organizationId: project.data.organizationId,
        status: project.data.status,
      } satisfies ProjectUserAssignmentListByUserEntry["project"],
      roles: roleKeys.data.map((key) => ({ displayName: definitions.get(key) ?? key, key })),
    })
  }
  entries.sort((left, right) =>
    left.project.id === right.project.id
      ? left.assignment.id.localeCompare(right.assignment.id)
      : left.project.id.localeCompare(right.project.id),
  )
  return resultCreate(entries)
}

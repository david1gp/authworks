import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { ProjectUserAssignmentRow } from "../persistence/projectUserAssignmentTable.js"
import type { ProjectUserAssignment } from "../public/projectUserAssignmentSchema.js"
import { projectRoleKeysDecode } from "./projectRoleKeysDecode.js"

export function projectUserAssignmentPublicViewCreate(row: ProjectUserAssignmentRow): Result<ProjectUserAssignment> {
  const roleKeys = projectRoleKeysDecode(row.roleKeys)
  if (!roleKeys.success) return roleKeys
  return resultCreate({
    createdAt: row.createdAt,
    id: row.id,
    projectId: row.projectId,
    realmId: row.realmId,
    roleKeys: roleKeys.data,
    updatedAt: row.updatedAt,
    userId: row.userId,
  })
}

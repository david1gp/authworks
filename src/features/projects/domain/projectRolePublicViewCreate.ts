import type { ProjectRoleRow } from "../persistence/projectRoleTable.js"
import type { ProjectRole } from "../public/projectRoleSchema.js"

export function projectRolePublicViewCreate(row: ProjectRoleRow): ProjectRole {
  return {
    createdAt: row.createdAt,
    displayName: row.displayName,
    ...(row.group === null ? {} : { group: row.group }),
    id: row.id,
    realmId: row.realmId,
    key: row.key,
    projectId: row.projectId,
    updatedAt: row.updatedAt,
  }
}

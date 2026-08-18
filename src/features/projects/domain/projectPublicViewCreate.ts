import type { ProjectRow } from "../persistence/projectTable.js"
import type { Project } from "../public/projectSchema.js"

export function projectPublicViewCreate(row: ProjectRow): Project {
  return {
    authorizationRequired: row.authorizationRequired === 1,
    createdAt: row.createdAt,
    id: row.id,
    realmId: row.realmId,
    name: row.name,
    organizationId: row.organizationId,
    projectAccessRequired: row.projectAccessRequired === 1,
    status: row.status as Project["status"],
    updatedAt: row.updatedAt,
  }
}

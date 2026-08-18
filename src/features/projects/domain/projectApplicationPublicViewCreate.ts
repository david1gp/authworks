import type { ProjectApplicationRow } from "../persistence/projectApplicationTable.js"
import type { ProjectApplication } from "../public/projectApplicationSchema.js"

export function projectApplicationPublicViewCreate(row: ProjectApplicationRow): ProjectApplication {
  return {
    applicationType: row.applicationType as ProjectApplication["applicationType"],
    createdAt: row.createdAt,
    id: row.id,
    realmId: row.realmId,
    name: row.name,
    projectId: row.projectId,
    status: row.status as ProjectApplication["status"],
    updatedAt: row.updatedAt,
  }
}

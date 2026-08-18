import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ProjectGrantRow } from "../persistence/projectGrantTable.js"
import type { ProjectGrant } from "../public/projectGrantSchema.js"
import { projectRoleKeysDecode } from "./projectRoleKeysDecode.js"

export function projectGrantPublicViewCreate(row: ProjectGrantRow): Result<ProjectGrant> {
  const roles = projectRoleKeysDecode(row.roleKeys)
  if (!roles.success)
    return resultErrorCodedCreate(
      "projectGrantPublicViewCreate",
      "The project grant is invalid.",
      "projects.grant-invalid",
    )
  return resultCreate({
    createdAt: row.createdAt,
    grantedOrganizationId: row.grantedOrganizationId,
    id: row.id,
    realmId: row.realmId,
    organizationId: row.organizationId,
    projectId: row.projectId,
    roleKeys: roles.data,
    status: row.status as ProjectGrant["status"],
    updatedAt: row.updatedAt,
  })
}

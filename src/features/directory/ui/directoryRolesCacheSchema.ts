import * as v from "valibot"
import { organizationRoleSchema } from "../../organizations/public/organizationRoleSchema.js"
import { projectListItemSchema } from "../../projects/public/projectListItemSchema.js"
import { projectRoleSchema } from "../../projects/public/projectRoleSchema.js"
import { directoryOrganizationUserSummarySchema } from "../public/directoryOrganizationUserSummarySchema.js"

/** Last successful roles response, rendered immediately while the page refreshes. */
export const directoryRolesCacheSchema = v.strictObject({
  entries: v.array(
    v.strictObject({
      owned: v.boolean(),
      project: projectListItemSchema,
      roles: v.array(projectRoleSchema),
    }),
  ),
  organizationRoles: v.array(organizationRoleSchema),
  summary: directoryOrganizationUserSummarySchema,
})

export type DirectoryRolesCache = v.InferOutput<typeof directoryRolesCacheSchema>

import * as v from "valibot"
import { listQuerySchema } from "../../../platform/http/listQuerySchema.js"
import { organizationResourceIdSchema } from "../../organizations/public/organizationResourceIdSchema.js"

export const projectListQuerySchema = v.strictObject({
  ...listQuerySchema.entries,
  grantedToOrganizationId: v.optional(organizationResourceIdSchema),
  organizationId: v.optional(organizationResourceIdSchema),
  status: v.optional(v.picklist(["active", "inactive", "all"])),
})

export type ProjectListQuery = v.InferOutput<typeof projectListQuerySchema>
